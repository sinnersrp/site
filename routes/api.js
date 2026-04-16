const express = require("express");
const { ensureAuth, ensureLeader } = require("../middleware/auth");
const ControleBau = require("../models/ControleBau");
const MovimentacaoBau = require("../models/MovimentacaoBau");
const FarmRegistro = require("../models/FarmRegistro");
const CaixaFaccao = require("../models/CaixaFaccao");
const MovimentacaoCaixa = require("../models/MovimentacaoCaixa");
const getSemanaRP = require("../utils/semanaRP");
const { metas } = require("../config/metas");

const router = express.Router();

router.get("/me", ensureAuth, async (req, res) => {
  try {
    const semana = getSemanaRP();

    const [registros, caixa] = await Promise.all([
      FarmRegistro.find({
        userId: req.user.discordId,
        registradoEm: {
          $gte: semana.inicio,
          $lte: semana.fim
        }
      }).sort({ registradoEm: -1 }),
      CaixaFaccao.findOne({ key: "caixa_principal" })
    ]);

    const totalFarm = registros.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
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
      registros,
      caixa: caixa || null
    });
  } catch (error) {
    console.error("Erro em /api/me:", error);
    res.status(500).json({ error: "Erro ao buscar dados do usuário." });
  }
});

router.get("/estoque", ensureLeader, async (req, res) => {
  try {
    const estoque = await ControleBau.find().sort({ tipo: 1, item: 1 });
    res.json(estoque);
  } catch (error) {
    console.error("Erro em /api/estoque:", error);
    res.status(500).json({ error: "Erro ao buscar estoque." });
  }
});

router.get("/movimentacoes", ensureLeader, async (req, res) => {
  try {
    const movimentacoes = await MovimentacaoBau.find()
      .sort({ registradoEm: -1, createdAt: -1 })
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
      const cargoBase = registro.cargo === "ajuste" ? "membro" : registro.cargo;
      if (!rankingMap[registro.userId]) {
        rankingMap[registro.userId] = {
          userId: registro.userId,
          username: registro.username,
          cargo: cargoBase,
          total: 0,
          meta: metas[cargoBase] || 100000
        };
      }

      rankingMap[registro.userId].total += Number(registro.valor) || 0;
    }

    const ranking = Object.values(rankingMap)
      .map((item) => ({
        ...item,
        falta: Math.max(item.meta - item.total, 0),
        percentual: item.meta > 0 ? Math.min((item.total / item.meta) * 100, 100) : 0,
        status: item.total >= item.meta ? "Bateu meta" : "Pendente"
      }))
      .sort((a, b) => b.total - a.total);

    res.json({ semana, ranking });
  } catch (error) {
    console.error("Erro em /api/ranking:", error);
    res.status(500).json({ error: "Erro ao buscar ranking." });
  }
});

router.get("/financeiro", ensureLeader, async (req, res) => {
  try {
    const [caixa, movimentacoesCaixa] = await Promise.all([
      CaixaFaccao.findOne({ key: "caixa_principal" }),
      MovimentacaoCaixa.find().sort({ registradoEm: -1, createdAt: -1 }).limit(100)
    ]);

    res.json({
      caixa,
      movimentacoesCaixa
    });
  } catch (error) {
    console.error("Erro em /api/financeiro:", error);
    res.status(500).json({ error: "Erro ao buscar financeiro." });
  }
});

module.exports = router;
