const express = require("express");
const { ensureAuth, ensureLeader } = require("../middleware/auth");
const ControleBau = require("../models/ControleBau");
const MovimentacaoBau = require("../models/MovimentacaoBau");
const FarmRegistro = require("../models/FarmRegistro");
const getSemanaRP = require("../utils/semanaRP");
const { metas } = require("../config/metas");

const router = express.Router();

router.get("/me", ensureAuth, async (req, res) => {
  try {
    const semana = getSemanaRP();

    const registros = await FarmRegistro.find({
      userId: req.user.discordId,
      registradoEm: {
        $gte: semana.inicio,
        $lte: semana.fim
      }
    }).sort({ registradoEm: -1 });

    const totalFarm = registros.reduce((acc, item) => acc + item.valor, 0);
    const meta = metas[req.user.role] || 100000;

    res.json({
      user: {
        discordId: req.user.discordId,
        username: req.user.username,
        globalName: req.user.globalName,
        avatar: req.user.avatar,
        role: req.user.role,
        siteRoles: req.user.siteRoles || []
      },
      semana,
      totalFarm,
      meta,
      falta: Math.max(meta - totalFarm, 0),
      percentual: meta > 0 ? Math.min((totalFarm / meta) * 100, 100) : 0,
      statusMeta: totalFarm >= meta ? "batida" : "pendente",
      registros
    });
  } catch (error) {
    console.error("Erro em /api/me:", error);
    res.status(500).json({ error: "Erro ao buscar dados do usuário." });
  }
});

router.get("/estoque", ensureLeader, async (req, res) => {
  try {
    const estoque = await ControleBau.find().sort({ item: 1 });
    res.json(estoque);
  } catch (error) {
    console.error("Erro em /api/estoque:", error);
    res.status(500).json({ error: "Erro ao buscar estoque." });
  }
});

router.get("/movimentacoes", ensureLeader, async (req, res) => {
  try {
    const movimentacoes = await MovimentacaoBau.find()
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(movimentacoes);
  } catch (error) {
    console.error("Erro em /api/movimentacoes:", error);
    res.status(500).json({ error: "Erro ao buscar movimentações." });
  }
});

router.get("/ranking", ensureLeader, async (req, res) => {
  try {
    const semana = getSemanaRP();

    const farmSemana = await FarmRegistro.find({
      registradoEm: {
        $gte: semana.inicio,
        $lte: semana.fim
      }
    });

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

    res.json({
      semana,
      ranking
    });
  } catch (error) {
    console.error("Erro em /api/ranking:", error);
    res.status(500).json({ error: "Erro ao buscar ranking." });
  }
});

router.post("/farm/manual", ensureLeader, async (req, res) => {
  try {
    const { userId, username, cargo, valor, observacao } = req.body;

    if (!userId || !username || !cargo || !valor) {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    const valorNumero = Number(valor);

    if (Number.isNaN(valorNumero) || valorNumero <= 0) {
      return res.status(400).json({ error: "Valor inválido." });
    }

    const semana = getSemanaRP();

    const registro = await FarmRegistro.create({
      userId,
      username,
      cargo,
      valor: valorNumero,
      semanaId: semana.semanaId,
      registradoEm: new Date(),
      origem: "site",
      observacao: observacao || ""
    });

    res.json({
      ok: true,
      registro
    });
  } catch (error) {
    console.error("Erro em /api/farm/manual:", error);
    res.status(500).json({ error: "Erro ao registrar farm manual." });
  }
});

/*
  Rota para o BOT gravar farm no mesmo banco.
  Depois podemos proteger com token interno.
*/
router.post("/farm/bot", async (req, res) => {
  try {
    const { userId, username, cargo, valor, observacao } = req.body;

    if (!userId || !username || !cargo || !valor) {
      return res.status(400).json({ error: "Dados incompletos." });
    }

    const valorNumero = Number(valor);

    if (Number.isNaN(valorNumero) || valorNumero <= 0) {
      return res.status(400).json({ error: "Valor inválido." });
    }

    const semana = getSemanaRP();

    const registro = await FarmRegistro.create({
      userId,
      username,
      cargo,
      valor: valorNumero,
      semanaId: semana.semanaId,
      registradoEm: new Date(),
      origem: "bot",
      observacao: observacao || ""
    });

    res.json({
      ok: true,
      registro
    });
  } catch (error) {
    console.error("Erro em /api/farm/bot:", error);
    res.status(500).json({ error: "Erro ao registrar farm do bot." });
  }
});

module.exports = router;