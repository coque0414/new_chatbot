import mongoose from "mongoose"

const SlotSchema = new mongoose.Schema({
  slotIndex:            { type: Number, required: true },
  isSupporter:          { type: Boolean, default: false },
  discordId:            { type: String, default: null },
  serverNick:           { type: String, default: null },
  characterName:        { type: String, default: null },
  characterClass:       { type: String, default: null },
  characterLevel:       { type: Number, default: null },
  characterCombatPower: { type: Number, default: null },
  role:                 { type: String, default: null },
})

const FixedRaidSchema = new mongoose.Schema({
  guildId:          { type: String, required: true },
  weekday:          { type: Number, required: true },  // 0=수 1=목 2=금 3=토 4=일 5=월 6=화
  time:             { type: String, required: true },  // "21:00"
  raidAlias:        { type: String, required: true },
  raidName:         { type: String, required: true },
  raidTag:          { type: String, required: true },
  difficulty:       { type: String, required: true },
  difficulty_level: { type: String, default: null },
  maxPlayers:       { type: Number, required: true },
  slots:            { type: [SlotSchema], default: [] },
  notifyEnabled:    { type: Boolean, default: true },
  nextWeekOverride: {
    time:   { type: String,  default: null },
    active: { type: Boolean, default: false },
  },
}, { timestamps: true })

FixedRaidSchema.index({ guildId: 1, weekday: 1 })
FixedRaidSchema.index({ weekday: 1, notifyEnabled: 1 })

export default mongoose.models.FixedRaid
  || mongoose.model("FixedRaid", FixedRaidSchema)
