const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const axios = require("axios");
const mongoose = require("mongoose");
const User = require("../models/User");
const { guildId, cargosMap, grupos } = require("./roles");

passport.serializeUser((user, done) => {
  // Salva o _id do Mongo na sessão
  done(null, user?._id?.toString() || null);
});

passport.deserializeUser(async (id, done) => {
  try {
    // Evita erro quando a sessão antiga ou inválida mandar id vazio/undefined
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return done(null, false);
    }

    const user = await User.findById(id);
    return done(null, user || false);
  } catch (error) {
    return done(error, null);
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

passport.use(
  new DiscordStrategy(
    {
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: process.env.DISCORD_CALLBACK_URL,
      scope: ["identify", "guilds", "guilds.members.read"]
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const avatar = profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=256`
          : "https://cdn.discordapp.com/embed/avatars/0.png";

        let discordRoles = [];
        let siteRoles = [];
        let role = "membro";

        try {
          const memberResponse = await axios.get(
            `https://discord.com/api/v10/users/@me/guilds/${guildId}/member`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`
              }
            }
          );

          discordRoles = memberResponse.data.roles || [];
          siteRoles = descobrirSiteRoles(discordRoles);
          role = descobrirRolePrincipal(siteRoles);
        } catch (err) {
          console.log("Não foi possível buscar cargos do membro no Discord.");
          console.log(err.response?.data || err.message);
        }

        let user = await User.findOne({ discordId: profile.id });

        const guilds =
          profile.guilds?.map((g) => ({
            id: g.id,
            name: g.name,
            icon: g.icon || null,
            owner: g.owner || false,
            permissions: g.permissions || 0
          })) || [];

        if (!user) {
          user = await User.create({
            discordId: profile.id,
            username: profile.username,
            globalName: profile.global_name || profile.username,
            avatar,
            role,
            discordRoles,
            siteRoles,
            guilds
          });
        } else {
          user.username = profile.username;
          user.globalName = profile.global_name || profile.username;
          user.avatar = avatar;
          user.role = role;
          user.discordRoles = discordRoles;
          user.siteRoles = siteRoles;
          user.guilds = guilds;
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        console.error("Erro no login Discord:", error);
        return done(error, null);
      }
    }
  )
);