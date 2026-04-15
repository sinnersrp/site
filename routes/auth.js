const express = require("express");
const passport = require("passport");

const router = express.Router();

router.get(
  "/discord",
  passport.authenticate("discord", {
    scope: ["identify", "guilds"]
  })
);

router.get(
  "/discord/callback",
  passport.authenticate("discord", {
    failureRedirect: "/"
  }),
  (req, res) => {
    res.redirect("/dashboard");
  }
);

router.get("/logout", (req, res, next) => {
  req.logout(function (err) {
    if (err) return next(err);

    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  });
});

module.exports = router;