const mongoose = require("mongoose");

const TIPOS_VALIDOS = ["bau_gerencia", "controle_bau"];
const ACOES_VALIDAS = [
  "entrada",
  "saida",
  "transferir",
  "transferencia_controle",
  "liberar",
  "retirar",
  "devolver"
];
const CARGOS_VALIDOS = ["gerencia", "membro"];

const movimentacaoBauSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true
    },
    username: {
      type: String,
      required: true,
      trim: true
    },
    item: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    itemOriginal: {
      type: String,
      default: "",
      trim: true
    },
    quantidade: {
      type: Number,
      required: true,
      min: 1
    },
    tipoMovimentacao: {
      type: String,
      required: true,
      enum: ACOES_VALIDAS
    },
    observacao: {
      type: String,
      default: "Sem observação",
      trim: true
    },
    canalId: {
      type: String,
      required: true,
      trim: true
    },
    canalNome: {
      type: String,
      required: true,
      trim: true
    },
    tipo: {
      type: String,
      required: true,
      enum: TIPOS_VALIDOS
    },
    acao: {
      type: String,
      required: true,
      enum: ACOES_VALIDAS
    },
    cargo: {
      type: String,
      required: true,
      enum: CARGOS_VALIDOS
    },
    registradoEm: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

movimentacaoBauSchema.index({ registradoEm: -1 });
movimentacaoBauSchema.index({ item: 1, registradoEm: -1 });
movimentacaoBauSchema.index({ canalId: 1, registradoEm: -1 });
movimentacaoBauSchema.index({ tipo: 1, acao: 1, registradoEm: -1 });

module.exports = mongoose.model("MovimentacaoBau", movimentacaoBauSchema);
