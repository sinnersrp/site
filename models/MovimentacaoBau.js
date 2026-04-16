const mongoose = require("mongoose");

const movimentacaoBauSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    cargo: {
      type: String,
      required: true
    },
    acao: {
      type: String,
      enum: [
        "entrada",
        "saida",
        "transferir",
        "transferencia_controle",
        "liberar",
        "retirar",
        "devolver",
        "liberou",
        "retirou",
        "devolveu",
        "entrada_gerencia",
        "saida_gerencia"
      ],
      required: true
    },
    item: {
      type: String,
      required: true
    },
    itemOriginal: {
      type: String,
      default: ""
    },
    quantidade: {
      type: Number,
      required: true
    },
    tipo: {
      type: String,
      enum: ["geral", "arma", "bau_gerencia", "controle_bau"],
      required: true
    },
    tipoMovimentacao: {
      type: String,
      default: ""
    },
    observacao: {
      type: String,
      default: ""
    },
    canalId: {
      type: String,
      required: false
    },
    canalNome: {
      type: String,
      required: false
    },
    registradoEm: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MovimentacaoBau", movimentacaoBauSchema);
