const express = require("express");
const { ensureAuth, ensureLeader } = require("../middleware/auth");
const ControleBau = require("../models/ControleBau");
const MovimentacaoBau = require("../models/MovimentacaoBau");
const FarmRegistro = require("../models/FarmRegistro");
const CaixaFaccao = require("../models/CaixaFaccao");
const MovimentacaoCaixa = require("../models/MovimentacaoCaixa");
const getSemanaRP = require("../utils/semanaRP");
const { metas } = require("../config/metas");
const { calcularMetaSemanal, META_SEMANAL } = require("../utils/metaSemanal");

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

    const totalFarm = meusRegistros.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    const metaSemanal = metas[req.user.role] || META_SEMANAL;
    const falta = Math.max(metaSemanal - totalFarm, 0);
    const percentual = metaSemanal > 0 ? Math.min((totalFarm / metaSemanal) * 100, 100) : 0;
    const statusMeta = totalFarm >= metaSemanal ? "batida" : "pendente";
    const resumoMeta = calcularMetaSemanal(totalFarm);

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
      resumoMeta
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

    const [estoque, movimentacoes, farmSemana, caixa, movimentacoesCaixa] = await Promise.all([
      ControleBau.find().sort({ item: 1 }),
      MovimentacaoBau.find().sort({ createdAt: -1 }).limit(40),
      FarmRegistro.find({
        registradoEm: {
          $gte: semana.inicio,
          $lte: semana.fim
        }
      }).sort({ registradoEm: -1 }),
      CaixaFaccao.findOne({ key: "caixa_principal" }),
      MovimentacaoCaixa.find().sort({ createdAt: -1 }).limit(20)
    ]);

    const rankingMap = {};

    for (const registro of farmSemana) {
      if (!rankingMap[registro.userId]) {
        rankingMap[registro.userId] = {
          userId: registro.userId,
          username: registro.username,
          cargo: registro.cargo,
          total: 0,
          meta: metas[registro.cargo] || META_SEMANAL,
          registros: 0,
          comprovantes: 0,
          ultimoRegistro: registro.registradoEm
        };
      }

      rankingMap[registro.userId].total += Number(registro.valor) || 0;
      rankingMap[registro.userId].registros += 1;
      if (registro.comprovante) rankingMap[registro.userId].comprovantes += 1;
      if (registro.registradoEm > rankingMap[registro.userId].ultimoRegistro) {
        rankingMap[registro.userId].ultimoRegistro = registro.registradoEm;
      }
    }

    const ranking = Object.values(rankingMap)
      .map((item) => ({
        ...item,
        falta: Math.max(item.meta - item.total, 0),
        percentual: item.meta > 0 ? Math.min((item.total / item.meta) * 100, 100) : 0,
        status: item.total >= item.meta ? "Bateu meta" : "Pendente",
        resumoMeta: calcularMetaSemanal(item.total)
      }))
      .sort((a, b) => b.total - a.total);

    const totalFarmSemana = farmSemana.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
    const membrosComMetaBatida = ranking.filter((item) => item.total >= item.meta).length;
    const membrosPendentes = ranking.filter((item) => item.total < item.meta).length;
    const itensNoEstoque = estoque.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0);
    const itensGerais = estoque.filter((item) => item.tipo === "geral").length;
    const itensArmas = estoque.filter((item) => item.tipo === "arma").length;

    res.render("admin", {
      title: "Painel da Liderança",
      user: req.user,
      semana,
      estoque,
      movimentacoes,
      ranking,
      resumoGeral: {
        totalFarmSemana,
        membrosMonitorados: ranking.length,
        membrosComMetaBatida,
        membrosPendentes,
        itensNoEstoque,
        itensGerais,
        itensArmas
      },
      caixa: caixa || {
        dinheiroSujoTotal: 0,
        dinheiroSujoDisponivel: 0,
        dinheiroLimpoTotal: 0,
        totalLavado: 0,
        caixaTotal: 0,
        ultimaSincronizacao: null
      },
      movimentacoesCaixa
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
