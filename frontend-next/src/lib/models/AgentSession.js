import mongoose from "mongoose"

const AgentSessionSchema = new mongoose.Schema({
  userId:  { type: String, required: true },  // Discord 유저 ID
  guildId: { type: String, required: true },

  messages: [{
    role:     { type: String, required: true },  // "user" | "assistant"
    content:  { type: String, default: "" },
    toolCall: { type: mongoose.Schema.Types.Mixed, default: null },
    timestamp: { type: Date, default: Date.now },
  }],

  draft: {
    raidAlias:         { type: String, default: null },
    raidTag:           { type: String, default: null },
    difficulty:        { type: String, default: null },
    difficultyLevel:   { type: String, default: null },
    date:              { type: String, default: null },
    time:              { type: String, default: null },
    maxPlayers:        { type: Number, default: null },
    isMobaChul:        { type: Boolean, default: false },
    hostRole:          { type: String, default: null },  // "dealer" | "support" | "none"
    hostCharacterName: { type: String, default: null },
    missingFields:     { type: [String], default: [] },
  },

  status: {
    type: String,
    enum: ["collecting", "ready", "confirmed", "cancelled"],
    default: "collecting",
  },
}, {
  timestamps: true,
})

// 30분간 갱신 없으면 자동 삭제
AgentSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 1800 })

export default mongoose.models.AgentSession || mongoose.model("AgentSession", AgentSessionSchema)
