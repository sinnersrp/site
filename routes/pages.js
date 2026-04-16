const express = require("express");
const { ensureAuth, ensureLeader } = require("../middleware/auth");
const ControleBau = require("../models/ControleBau");
const MovimentacaoBau = require("../models/MovimentacaoBau");
const FarmRegistro = require("../models/FarmRegistro");
const getSemanaRP = require("../utils/semanaRP");
const { metas } = require("../config/metas");

const router = express.Router();

function calcularStatusMeta(total, meta) {
  if (total >= meta) return "batida";
  if (total >= meta * 0.7) return "quase";
  return "pendente";
}

router.get("/", (req, res) => {
  res.render("home", {
    title: "SINNERS FAMILY",
    user: req.user || null
  });
});

router.get("/dashboard", ensureAuth, async (req, res) => {
  try {
    const semana = getSemanaRP();

    const [meusRegistros, farmSemana, estoque, movimentacoesRecentes] = await Promise.all([
      FarmRegistro.find({
        userId: req.user.discordId,
        registradoEm: {
          $gte: semana.inicio,
          $lte: semana.fim
        }
      }).sort({ registradoEm: -1 }),

      FarmRegistro.find({
        registradoEm: {
          $gte: semana.inicio,
          $lte: semana.fim
        }
      }).sort({ registradoEm: -1 }),

      ControleBau.find().sort({ item: 1 }),

      MovimentacaoBau.find().sort({ createdAt: -1 }).limit(8)
    ]);

    const totalFarm = meusRegistros.reduce((acc, item) => acc + Number(item.valor || 0), 0);
    const metaSemanal = metas[req.user.role] || 100000;
    const falta = Math.max(metaSemanal - totalFarm, 0);
    const percentual = metaSemanal > 0
      ? Math.min((totalFarm / metaSemanal) * 100, 100)
      : 0;
    const statusMeta = calcularStatusMeta(totalFarm, metaSemanal);

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

      rankingMap[registro.userId].total += Number(registro.valor || 0);
    }

    const ranking = Object.values(rankingMap)
      .map((item) => ({
        ...item,
        falta: Math.max(item.meta - item.total, 0),
        percentual: item.meta > 0 ? Math.min((item.total / item.meta) * 100, 100) : 0,
        status: calcularStatusMeta(item.total, item.meta)
      }))
      .sort((a, b) => b.total - a.total);

    const minhaPosicao = ranking.findIndex((item) => item.userId === req.user.discordId) + 1;
    const topRanking = ranking.slice(0, 5);

    const totalFarmFaccao = farmSemana.reduce((acc, item) => acc + Number(item.valor || 0), 0);
    const totalMembros = ranking.length;

    const estoqueResumo = {
      itens: estoque.length,
      quantidadeTotal: estoque.reduce((acc, item) => acc + Number(item.quantidade || 0), 0)
    };

    res.render("dashboard", {
      title: "Meu Painel",
      user: req.user,
      semana,
      totalFarm,
      metaSemanal,
      falta,
      percentual,
      statusMeta,
      meusRegistros,
      ranking,
      topRanking,
      minhaPosicao,
      totalFarmFaccao,
      totalMembros,
      estoqueResumo,
      movimentacoesRecentes
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

    const [estoque, movimentacoes, farmSemana] = await Promise.all([
      ControleBau.find().sort({ item: 1 }),
      MovimentacaoBau.find().sort({ createdAt: -1 }).limit(40),
      FarmRegistro.find({
        registradoEm: {
          $gte: semana.inicio,
          $lte: semana.fim
        }
      }).sort({ registradoEm: -1 })
    ]);

    const rankingMap = {};

    for (const registro of farmSemana) {
      if (!rankingMap[registro.userId]) {
        rankingMap[registro.userId] = {
          userId: registro.userId,
          username: registro.username,
          cargo: registro.cargo,
          total: 0,
          meta: metas[registro.cargo] || 100000,
          registros: 0
        };
      }

      rankingMap[registro.userId].total += Number(registro.valor || 0);
      rankingMap[registro.userId].registros += 1;
    }

    const ranking = Object.values(rankingMap)
      .map((item) => ({
        ...item,
        falta: Math.max(item.meta - item.total, 0),
        percentual: item.meta > 0 ? Math.min((item.total / item.meta) * 100, 100) : 0,
        status: calcularStatusMeta(item.total, item.meta)
      }))
      .sort((a, b) => b.total - a.total);

    const pendentes = ranking.filter((item) => item.total < item.meta);
    const bateramMeta = ranking.filter((item) => item.total >= item.meta);

    const resumoFarm = {
      totalFarm: farmSemana.reduce((acc, item) => acc + Number(item.valor || 0), 0),
      totalRegistros: farmSemana.length,
      membrosAtivos: ranking.length,
      bateramMeta: bateramMeta.length,
      pendentes: pendentes.length
    };

    const resumoEstoque = {
      totalItens: estoque.length,
      totalQuantidade: estoque.reduce((acc, item) => acc + Number(item.quantidade || 0), 0)
    };

    const topItens = [...estoque]
      .sort((a, b) => Number(b.quantidade || 0) - Number(a.quantidade || 0))
      .slice(0, 8);

    const ultimosFarms = farmSemana.slice(0, 10);

    res.render("admin", {
      title: "Painel da Liderança",
      user: req.user,
      semana,
      estoque,
      movimentacoes,
      ranking,
      pendentes,
      bateramMeta,
      resumoFarm,
      resumoEstoque,
      topItens,
      ultimosFarms
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