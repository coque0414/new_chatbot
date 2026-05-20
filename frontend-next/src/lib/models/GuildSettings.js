import mongoose from "mongoose"

const GuildSettingsSchema = new mongoose.Schema({
  guildId:                  { type: String, required: true, unique: true },
  guildName:                { type: String, default: null },
  guildIcon:                { type: String, default: null },
  announcementChannelId:    { type: String, default: null },   // 레이드 공고 채널
  announcementChannelName:  { type: String, default: null },
  createChannelId:          { type: String, default: null },   // 레이드 생성 채널
  createChannelName:        { type: String, default: null },
  voiceChannelEnabled:      { type: Boolean, default: true },
}, { timestamps: true })

export default mongoose.models.GuildSettings || mongoose.model("GuildSettings", GuildSettingsSchema)
