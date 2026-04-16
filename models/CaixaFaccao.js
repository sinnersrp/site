const mongoose = require("mongoose");

const caixaFaccaoSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "caixa_principal",
      unique: true
    },
    dinheiroSujoTotal: {
      type: Number,
      default: 0
    },
    dinheiroSujoDisponivel: {
      type: Number,
      default: 0
    },
    dinheiroLimpoTotal: {
      type: Number,
      default: 0
    },
    totalLavado: {
      type: Number,
      default: 0
    },
    caixaTotal: {
      type: Number,
      default: 0
    },
    ultimaSincronizacao: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("CaixaFaccao", caixaFaccaoSchema);
