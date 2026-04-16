const mongoose = require("mongoose");

const farmRegistroSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true
    },
    username: {
      type: String,
      required: true
    },
    cargo: {
      type: String,
      required: true,
      enum: ["membro", "gerente", "lider", "ajuste"]
    },
    valor: {
      type: Number,
      required: true,
      min: 1
    },
    comprovante: {
      type: String,
      default: ""
    },
    semanaId: {
      type: String,
      required: true,
      index: true
    },
    registradoEm: {
      type: Date,
      default: Date.now,
      index: true
    },
    origem: {
      type: String,
      enum: ["site", "bot"],
      default: "bot"
    },
    observacao: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("FarmRegistro", farmRegistroSchema);
