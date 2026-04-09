import mongoose from "mongoose"

const UserCharactersSchema = new mongoose.Schema({
  discordId:          { type: String, required: true, unique: true },
  representCharacter: { type: String },   // 대표캐릭터명
  characters: [{
    name:         String,   // 캐릭터명
    class:        String,   // 직업
    level:        Number,   // 아이템 레벨
    server:       String,   // 서버명
    combatPower:  { type: Number, default: null },  // 전투력
  }],
  verifiedAt: Date,
  lastSyncAt: Date,
}, {
  timestamps: true,
})

export default mongoose.models.UserCharacters || mongoose.model("UserCharacters", UserCharactersSchema)
