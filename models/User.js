const mongoose = require("mongoose");

const guildSchema = new mongoose.Schema(
  {
    id: String,
    name: String,
    icon: String,
    owner: Boolean,
    permissions: {
      type: String,
      default: "0"
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    discordId: {
      type: String,
      required: true,
      unique: true
    },
    username: {
      type: String,
      required: true
    },
    globalName: {
      type: String,
      default: null
    },
    avatar: {
      type: String,
      default: null
    },
    role: {
      type: String,
      enum: ["membro", "gerente", "lider"],
      default: "membro"
    },
    guilds: {
      type: [guildSchema],
      default: []
    },
    discordRoles: {
      type: [String],
      default: []
    },
    siteRoles: {
      type: [String],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);