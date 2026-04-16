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

function normalizarAcaoMovimentacao(item) {
  const valor = item.acao || item.tipoMovimentacao || "movimentacao";

  const mapa = {
    entrada: "Entrada",
    saida: "Saída",
    transferir: "Transferência",
    transferencia_controle: "Transferência p/ controle",
    liberar: "Liberação",
    retirar: "Retirada",
    devolver: "Devolução",
    liberou: "Liberação",
    retirou: "Retirada",
    devolveu: "Devolução",
    entrada_gerencia: "Entrada gerência",
    saida_gerencia: "Saída gerência"
  };

  return mapa[valor] || valor;
}

function normalizarTipoBau(item) {
  if (item.tipo === "bau_gerencia") return "Baú gerência";
  if (item.tipo === "controle_bau") return "Controle de baú";
  return item.tipo || "-";
}

function resumirEstoque(estoque) {
  return estoque.reduce(
    (acc, item) => {
      const quantidade = Number(item.quantidade) || 0;
      acc.totalItens += 1;
      acc.totalQuantidade += quantidade;

      if (item.tipo === "arma") {
        acc.totalArmas += quantidade;
      } else {
        acc.totalGerais += quantidade;
      }

      return acc;
    },
    {
      totalItens: 0,
      totalQuantidade: 0,
      totalGerais: 0,
      totalArmas: 0
    }
  );
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

    const [meusRegistros, caixa] = await Promise.all([
      FarmRegistro.find({
        userId: req.user.discordId,
        registradoEm: {
          $gte: semana.inicio,
          $lte: semana.fim
        }
      }).sort({ registradoEm: -1 }),
      CaixaFaccao.findOne({ key: "caixa_principal" })
    ]);

    const totalFarm = meusRegistros.reduce((acc, item) => acc + (Number(item.valor) || 0), 0);
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
      meusRegistros,
      caixa: caixa || {
        dinheiroSujoTotal: 0,
        dinheiroSujoDisponivel: 0,
        dinheiroLimpoTotal: 0,
        totalLavado: 0,
        caixaTotal: 0,
        ultimaSincronizacao: null
      }
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
      ControleBau.find().sort({ tipo: 1, item: 1 }),
      MovimentacaoBau.find().sort({ registradoEm: -1, createdAt: -1 }).limit(30),
      FarmRegistro.find({
        registradoEm: {
          $gte: semana.inicio,
          $lte: semana.fim
        }
      }).sort({ registradoEm: -1 }),
      CaixaFaccao.findOne({ key: "caixa_principal" }),
      MovimentacaoCaixa.find().sort({ registradoEm: -1, createdAt: -1 }).limit(20)
    ]);

    const rankingMap = {};

    for (const registro of farmSemana) {
      const cargoBase = registro.cargo === "ajuste" ? "membro" : registro.cargo;

      if (!rankingMap[registro.userId]) {
        rankingMap[registro.userId] = {
          userId: registro.userId,
          username: registro.username,
          cargo: cargoBase,
          total: 0,
          meta: metas[cargoBase] || 100000,
          registros: 0,
          ultimoComprovante: registro.comprovante || ""
        };
      }

      rankingMap[registro.userId].total += Number(registro.valor) || 0;
      rankingMap[registro.userId].registros += 1;
      if (!rankingMap[registro.userId].ultimoComprovante && registro.comprovante) {
        rankingMap[registro.userId].ultimoComprovante = registro.comprovante;
      }
    }

    const ranking = Object.values(rankingMap)
      .map((item) => ({
        ...item,
        falta: Math.max(item.meta - item.total, 0),
        percentual: item.meta > 0 ? Math.min((item.total / item.meta) * 100, 100) : 0,
        status: item.total >= item.meta ? "Bateu meta" : "Pendente"
      }))
      .sort((a, b) => b.total - a.total);

    const resumoFarmSemana = farmSemana.reduce(
      (acc, item) => {
        acc.total += Number(item.valor) || 0;
        acc.registros += 1;
        if (item.comprovante) acc.comprovantes += 1;
        return acc;
      },
      { total: 0, registros: 0, comprovantes: 0 }
    );

    const resumoEstoque = resumirEstoque(estoque);

    const caixaResumo = caixa || {
      dinheiroSujoTotal: 0,
      dinheiroSujoDisponivel: 0,
      dinheiroLimpoTotal: 0,
      totalLavado: 0,
      caixaTotal: 0,
      ultimaSincronizacao: null
    };

    const movimentacoesFormatadas = movimentacoes.map((item) => ({
      ...item.toObject(),
      acaoLabel: normalizarAcaoMovimentacao(item),
      tipoLabel: normalizarTipoBau(item)
    }));

    res.render("admin", {
      title: "Painel da Liderança",
      user: req.user,
      semana,
      estoque,
      resumoEstoque,
      movimentacoes: movimentacoesFormatadas,
      ranking,
      resumoFarmSemana,
      caixa: caixaResumo,
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
