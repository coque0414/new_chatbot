import mongoose from "mongoose"

const TrainRaidSchema = new mongoose.Schema({
  // 기차 식별
  trainKey: { type: String, required: true },
  // 예: "1680_3", "1710_3_성당", "1730_4" 등

  trainLabel: { type: String, required: true },
  // 예: "1680 노노하 3종 기차 (3막 노말 + 2막 노말 + 1막 하드)"

  trainRaids: [{
    order: Number,
    raidAlias: String,
    raidTag: String,
    raidName: String,
    difficulty: String,
    maxPlayers: Number,
  }],

  maxPlayers: { type: Number, required: true },
  isMobaChul: { type: Boolean, default: false },
  date: { type: String, default: "" },
  time: { type: String, default: "" },

  discordChannelId: { type: String },
  discordMessageId: { type: String },
  guildId: { type: String },

  hostId: { type: String, required: true },
  hostName: { type: String, required: true },
  hostImage: { type: String },

  participants: [{
    userId: String,
    userName: String,
    userImage: String,
    role: String,
    characterName:        { type: String, default: null },
    characterClass:       { type: String, default: null },
    characterLevel:       { type: Number, default: null },
    characterCombatPower: { type: Number, default: null },
    joinedAt: { type: Date, default: Date.now },
  }],

  status: {
    type: String,
    enum: ["모집중", "모집완료", "취소", "출발완료"],
    default: "모집중",
  },

  dmSent: { type: Boolean, default: false },
  voiceChannelId: { type: String, default: null },
  voiceChannelCreatedAt: { type: Date, default: null },
  notifyMinutesBefore: { type: Number, enum: [10, 20, 30], default: 30 },
}, { timestamps: true })

export default mongoose.models.TrainRaid || mongoose.model("TrainRaid", TrainRaidSchema)
