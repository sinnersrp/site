const mongoose = require("mongoose");

const controleBauSchema = new mongoose.Schema(
  {
    item: {
      type: String,
      required: true,
      unique: true
    },
    quantidade: {
      type: Number,
      required: true,
      default: 0
    },
    tipo: {
      type: String,
      enum: ["geral", "arma"],
      required: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("ControleBau", controleBauSchema);