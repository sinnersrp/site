const express = require("express");
const crypto = require("crypto");
const axios = require("axios");
const DiscordOAuth2 = require("discord-oauth2");

const User = require("../models/User");
const { guildId, cargosMap, grupos } = require("../config/roles");

const router = express.Router();
const oauth = new DiscordOAuth2();

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

    const url = oauth.generateAuthUrl({
      clientId: String(process.env.DISCORD_CLIENT_ID || "").trim(),
      redirectUri: String(process.env.DISCORD_CALLBACK_URL || "").trim(),
      responseType: "code",
      scope: ["identify", "guilds"],
      state
    });

    console.log("Iniciando login Discord");
    console.log("Callback URL:", String(process.env.DISCORD_CALLBACK_URL || "").trim());
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
      console.log("Sessão não encontrada no callback");
      return res.status(500).render("error", {
        title: "Erro no login",
        user: null,
        message: "Sessão não encontrada no callback."
      });
    }

    console.log("State salvo na sessão:", req.session.discordOAuthState);
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

    const tokenData = await Promise.race([
      oauth.tokenRequest({
        clientId: String(process.env.DISCORD_CLIENT_ID || "").trim(),
        clientSecret: String(process.env.DISCORD_CLIENT_SECRET || "").trim(),
        code: String(code),
        scope: "identify guilds",
        grantType: "authorization_code",
        redirectUri: String(process.env.DISCORD_CALLBACK_URL || "").trim()
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout ao trocar code por token")), 15000)
      )
    ]);

    console.log("Token obtido com sucesso");

    const accessToken = tokenData.access_token;

    const profileResponse = await Promise.race([
      axios.get("https://discord.com/api/v10/users/@me", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout ao buscar perfil do Discord")), 15000)
      )
    ]);

    console.log("Perfil do Discord carregado");

    const guildsResponse = await Promise.race([
      axios.get("https://discord.com/api/v10/users/@me/guilds", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout ao buscar servidores do Discord")), 15000)
      )
    ]);

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
        console.log("Tentando buscar cargos do membro via bot");

        const memberResponse = await Promise.race([
          axios.get(
            `https://discord.com/api/v10/guilds/${guildId}/members/${profile.id}`,
            {
              headers: {
                Authorization: `Bot ${String(process.env.DISCORD_BOT_TOKEN).trim()}`
              }
            }
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout ao buscar cargos do membro via bot")), 15000)
          )
        ]);

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

    let user = await User.findOne({ discordId: profile.id });

    const guildsFormatadas = guilds.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon || null,
      owner: g.owner || false,
      permissions: String(g.permissions || "0")
    }));

    if (!user) {
      console.log("Criando novo usuário no banco");

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
      console.log("Atualizando usuário existente no banco");

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
    console.log("Usuário salvo na sessão:", req.session.userId);

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
      message: `Falha ao concluir o login com Discord: ${error.message}`
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