import mongoose from "mongoose"

const BotStatsSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // "2026-06-15"
  commandUsage: {
    모집:           { type: Number, default: 0 },
    모바출모집:     { type: Number, default: 0 },
    참가:           { type: Number, default: 0 },
    같이참가:       { type: Number, default: 0 },
    지난레이드삭제: { type: Number, default: 0 },
  },
  buttonClicks: {
    join_dealer:   { type: Number, default: 0 },
    join_support:  { type: Number, default: 0 },
    cancel:        { type: Number, default: 0 },
    launch:        { type: Number, default: 0 },
    cancel_raid:   { type: Number, default: 0 },
    participants:  { type: Number, default: 0 },
  },
  raidsCreated: {
    web:     { type: Number, default: 0 },
    discord: { type: Number, default: 0 },
  },
  raidsJoined: {
    web:     { type: Number, default: 0 },
    discord: { type: Number, default: 0 },
  },
}, { timestamps: true })

export default mongoose.models.BotStats
  || mongoose.model("BotStats", BotStatsSchema)
