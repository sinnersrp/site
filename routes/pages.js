const express = require("express");
const { ensureAuth, ensureLeader } = require("../middleware/auth");
const ControleBau = require("../models/ControleBau");
const MovimentacaoBau = require("../models/MovimentacaoBau");
const FarmRegistro = require("../models/FarmRegistro");
const getSemanaRP = require("../utils/semanaRP");
const { metas } = require("../config/metas");

const router = express.Router();

router.get("/", (req, res) => {
  res.render("home", {
    title: "SINNERS FAMILY",
    user: req.user || null
  });
});

router.get("/dashboard", ensureAuth, async (req, res) => {
  try {
    const semana = getSemanaRP();

    const meusRegistros = await FarmRegistro.find({
      userId: req.user.discordId,
      registradoEm: {
        $gte: semana.inicio,
        $lte: semana.fim
      }
    }).sort({ registradoEm: -1 });

    const totalFarm = meusRegistros.reduce((acc, item) => acc + item.valor, 0);
    const metaSemanal = metas[req.user.role] || 100000;
    const falta = Math.max(metaSemanal - totalFarm, 0);
    const percentual = metaSemanal > 0
      ? Math.min((totalFarm / metaSemanal) * 100, 100)
      : 0;
    const statusMeta = totalFarm >= metaSemanal ? "batida" : "pendente";

    res.render("dashboard", {
      title: "Meu Painel",
      user: req.user,
      semana,
      totalFarm,
      metaSemanal,
      falta,
      percentual,
      statusMeta,
      meusRegistros
    });
  } catch (error) {
    console.error("Erro no dashboard:", error);
    res.status(500).render("error", {
      title: "Erro",
      user: req.user || null,
      message: "Erro ao carregar dashboard."
    });
  }
});

router.get("/admin", ensureLeader, async (req, res) => {
  try {
    const semana = getSemanaRP();

    const estoque = await ControleBau.find().sort({ item: 1 });

    const movimentacoes = await MovimentacaoBau.find()
      .sort({ createdAt: -1 })
      .limit(30);

    const farmSemana = await FarmRegistro.find({
      registradoEm: {
        $gte: semana.inicio,
        $lte: semana.fim
      }
    }).sort({ registradoEm: -1 });

    const rankingMap = {};

    for (const registro of farmSemana) {
      if (!rankingMap[registro.userId]) {
        rankingMap[registro.userId] = {
          userId: registro.userId,
          username: registro.username,
          cargo: registro.cargo,
          total: 0,
          meta: metas[registro.cargo] || 100000
        };
      }

      rankingMap[registro.userId].total += registro.valor;
    }

    const ranking = Object.values(rankingMap)
      .map((item) => ({
        ...item,
        falta: Math.max(item.meta - item.total, 0),
        percentual: item.meta > 0 ? Math.min((item.total / item.meta) * 100, 100) : 0,
        status: item.total >= item.meta ? "Bateu meta" : "Pendente"
      }))
      .sort((a, b) => b.total - a.total);

    res.render("admin", {
      title: "Painel da Liderança",
      user: req.user,
      semana,
      estoque,
      movimentacoes,
      ranking
    });
  } catch (error) {
    console.error("Erro no admin:", error);
    res.status(500).render("error", {
      title: "Erro",
      user: req.user || null,
      message: "Erro ao carregar painel administrativo."
    });
  }
});

module.exports = router;