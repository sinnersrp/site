function ensureAuth(req, res, next) {
  if (req.user) {
    return next();
  }

  return res.redirect("/");
}

function ensureLeader(req, res, next) {
  if (!req.user) {
    return res.redirect("/");
  }

  if (req.user.role === "lider" || req.user.role === "gerente") {
    return next();
  }

  return res.status(403).render("unauthorized", {
    title: "Sem permissão",
    user: req.user || null
  });
}

module.exports = {
  ensureAuth,
  ensureLeader
};