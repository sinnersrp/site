const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const mongoose = require("mongoose");
const User = require("../models/User");
const { cargosMap, grupos } = require("./roles");

passport.serializeUser((user, done) => {
  done(null, user?._id?.toString() || null);
});

passport.deserializeUser(async (id, done) => {
  try {
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
      clientID: String(process.env.DISCORD_CLIENT_ID || "").trim(),
      clientSecret: String(process.env.DISCORD_CLIENT_SECRET || "").trim(),
      callbackURL: String(process.env.DISCORD_CALLBACK_URL || "").trim(),
      scope: ["identify", "guilds"]
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const avatar = profile.avatar
          ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=256`
          : "https://cdn.discordapp.com/embed/avatars/0.png";

        let discordRoles = [];
        let siteRoles = [];
        let role = "membro";

        const guilds =
          profile.guilds?.map((g) => ({
            id: g.id,
            name: g.name,
            icon: g.icon || null,
            owner: g.owner || false,
            permissions: String(g.permissions || "0")
          })) || [];

        siteRoles = descobrirSiteRoles(discordRoles);
        role = descobrirRolePrincipal(siteRoles);

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