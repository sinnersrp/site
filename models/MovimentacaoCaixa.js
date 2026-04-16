const mongoose = require("mongoose");

const movimentacaoCaixaSchema = new mongoose.Schema(
  {
    responsavelId: {
      type: String,
      required: true
    },
    responsavelTag: {
      type: String,
      required: true
    },
    tipo: {
      type: String,
      enum: ["lavagem", "ajuste_entrada", "ajuste_saida"],
      required: true
    },
    valor: {
      type: Number,
      required: true
    },
    observacao: {
      type: String,
      default: ""
    },
    registradoEm: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MovimentacaoCaixa", movimentacaoCaixaSchema);
