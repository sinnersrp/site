const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
const https = require("https");
const dns = require("dns");

const User = require("../models/User");
const { guildId, cargosMap, grupos } = require("../config/roles");

const router = express.Router();

const httpsAgent = new https.Agent({
  keepAlive: true,
  lookup: (hostname, options, callback) => {
    if (typeof options === "function") {
      callback = options;
      options = {};
    }

    return dns.lookup(
      hostname,
      {
        ...options,
        family: 4,
        all: false
      },
      callback
    );
  }
});

function descobrirSiteRoles(memberRoleIds = []) {
  const rolesEncontradas = [];

  for (const [nomeSistema, discordRoleId] of Object.entries(cargosMap)) {
    if (memberRoleIds.includes(discordRoleId)) {
      rolesEncontradas.push(nomeSistema);
    }
  }

  return rolesEncontradas;
}

function descobrirRolePrincipal(siteRoles = []) {
  const temLider = siteRoles.some((cargo) => grupos.lider.includes(cargo));
  if (temLider) return "lider";

  const temGerente = siteRoles.some((cargo) => grupos.gerente.includes(cargo));
  if (temGerente) return "gerente";

  return "membro";
}

router.get("/discord", (req, res) => {
  try {
    const state = crypto.randomBytes(16).toString("hex");
    req.session.discordOAuthState = state;

    const params = new URLSearchParams({
      client_id: String(process.env.DISCORD_CLIENT_ID || "").trim(),
      redirect_uri: String(process.env.DISCORD_CALLBACK_URL || "").trim(),
      response_type: "code",
      scope: "identify guilds",
      state
    });

    const url = `https://discord.com/oauth2/authorize?${params.toString()}`;

    console.log("Iniciando login Discord");
    console.log("URL de retorno:", String(process.env.DISCORD_CALLBACK_URL || "").trim());
    console.log("State gerado:", state);

    return req.session.save(() => {
      res.redirect(url);
    });
  } catch (error) {
    console.error("Erro ao iniciar login Discord:", error.response?.data || error.message || error);
    return res.status(500).render("error", {
      title: "Erro no login",
      user: req.user || null,
      message: "Não foi possível iniciar o login com Discord."
    });
  }
});

router.get("/discord/callback", async (req, res) => {
  try {
    console.log("==========================================");
    console.log("Callback Discord iniciado");
    console.log("Query recebida:", req.query);

    const { code, state } = req.query;

    if (!req.session) {
      return res.status(500).render("error", {
        title: "Erro no login",
        user: null,
        message: "Sessão não encontrada no callback."
      });
    }

    console.log("Salvo de Estado na sessão:", req.session.discordOAuthState);
    console.log("Code recebido:", !!code);
    console.log("State recebido:", state);

    if (!code) {
      return res.status(400).render("error", {
        title: "Erro no login",
        user: null,
        message: "Código de autorização não recebido do Discord."
      });
    }

    if (!state || state !== req.session.discordOAuthState) {
      return res.status(400).render("error", {
        title: "Erro no login",
        user: null,
        message: "State inválido no login com Discord."
      });
    }

    delete req.session.discordOAuthState;
    console.log("State validado com sucesso");

    const tokenParams = new URLSearchParams({
      client_id: String(process.env.DISCORD_CLIENT_ID || "").trim(),
      client_secret: String(process.env.DISCORD_CLIENT_SECRET || "").trim(),
      grant_type: "authorization_code",
      code: String(code),
      redirect_uri: String(process.env.DISCORD_CALLBACK_URL || "").trim()
    });

    console.log("Iniciando troca de code por token no Discord...");

    const tokenResponse = await axios.post(
      "https://discord.com/api/oauth2/token",
      tokenParams.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "SinnersFamily/1.0"
        },
        timeout: 30000,
        httpsAgent
      }
    );

    console.log("Token obtido com sucesso");

    const accessToken = tokenResponse.data.access_token;

    const profileResponse = await axios.get("https://discord.com/api/v10/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "SinnersFamily/1.0"
      },
      timeout: 30000,
      httpsAgent
    });

    console.log("Perfil do Discord carregado");

    const guildsResponse = await axios.get("https://discord.com/api/v10/users/@me/guilds", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "SinnersFamily/1.0"
      },
      timeout: 30000,
      httpsAgent
    });

    console.log("Guildas do Discord carregadas");

    const profile = profileResponse.data;
    const guilds = Array.isArray(guildsResponse.data) ? guildsResponse.data : [];

    const avatar = profile.avatar
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=256`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    let discordRoles = [];
    let siteRoles = [];
    let role = "membro";

    if (process.env.DISCORD_BOT_TOKEN) {
      try {
        const memberResponse = await axios.get(
          `https://discord.com/api/v10/guilds/${guildId}/members/${profile.id}`,
          {
            headers: {
              Authorization: `Bot ${String(process.env.DISCORD_BOT_TOKEN).trim()}`,
              "User-Agent": "SinnersFamily/1.0"
            },
            timeout: 30000,
            httpsAgent
          }
        );

        discordRoles = memberResponse.data.roles || [];
        siteRoles = descobrirSiteRoles(discordRoles);
        role = descobrirRolePrincipal(siteRoles);

        console.log("Cargos do membro carregados com sucesso");
      } catch (err) {
        console.log("Não foi possível buscar cargos do membro via bot.");
        console.log(err.response?.data || err.message || err);
      }
    } else {
      console.log("DISCORD_BOT_TOKEN não encontrado. Usuário seguirá como membro.");
    }

    const guildsFormatadas = guilds.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon || null,
      owner: g.owner || false,
      permissions: String(g.permissions || "0")
    }));

    let user = await User.findOne({ discordId: profile.id });

    if (!user) {
      user = await User.create({
        discordId: profile.id,
        username: profile.username,
        globalName: profile.global_name || profile.username,
        avatar,
        role,
        discordRoles,
        siteRoles,
        guilds: guildsFormatadas
      });
    } else {
      user.username = profile.username;
      user.globalName = profile.global_name || profile.username;
      user.avatar = avatar;
      user.role = role;
      user.discordRoles = discordRoles;
      user.siteRoles = siteRoles;
      user.guilds = guildsFormatadas;
      await user.save();
    }

    req.session.userId = user._id.toString();

    return req.session.save((err) => {
      if (err) {
        console.error("Erro ao salvar sessão:", err);
        return res.status(500).render("error", {
          title: "Erro no login",
          user: null,
          message: "Falha ao salvar a sessão do usuário."
        });
      }

      console.log("Sessão salva com sucesso. Redirecionando para /dashboard");
      return res.redirect("/dashboard");
    });
  } catch (error) {
    console.error("Erro no callback Discord:", error.response?.data || error.message || error);

    return res.status(500).render("error", {
      title: "Erro no login",
      user: null,
      message: `Falha ao concluir o login com Discord: ${error.response?.data?.error_description || error.message}`
    });
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

module.exports = router;