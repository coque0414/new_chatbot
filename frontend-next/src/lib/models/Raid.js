import mongoose from "mongoose"

const RaidSchema = new mongoose.Schema({
  // 레이드 정보
  raidName: { type: String, required: true },      // 레이드 정식 명칭
  raidAlias: { type: String, required: true },     // 별칭 (에기르 등)
  raidTag: { type: String, required: true },       // 태그 (1막 등)
  difficulty: { type: String, required: true },    // 난이도
  maxPlayers: { type: Number, required: true },    // 최대 인원

  // 일정
  date: { type: String, default: "" },             // 날짜 (YYYY-MM-DD) - 모바출 시 빈 문자열
  time: { type: String, default: "" },             // 시간 (HH:MM)     - 모바출 시 빈 문자열
  isMobaChul: { type: Boolean, default: false },   // 모바출 여부

  // Discord
  discordChannelId: { type: String },              // 채널 ID
  discordMessageId: { type: String },              // 공지 메시지 ID
  guildId: { type: String },                       // 서버(길드) ID

  // 주최자
  hostId: { type: String, required: true },        // Discord 유저 ID
  hostName: { type: String, required: true },      // 유저 이름
  hostImage: { type: String },                     // 프로필 이미지

  // 참가자
  participants: [{
    userId: String,
    userName: String,
    userImage: String,
    role: String,
    characterName:        { type: String, default: null },  // 캐릭터명
    characterClass:       { type: String, default: null },  // 직업
    characterLevel:       { type: Number, default: null },  // 아이템 레벨
    characterCombatPower: { type: Number, default: null },  // 전투력
    joinedAt: { type: Date, default: Date.now }
  }],

  // 상태
  status: {
    type: String,
    enum: ["모집중", "모집완료", "진행중", "완료", "취소", "출발완료"],
    default: "모집중"
  },

  // 기차 레이드
  isTrain: { type: Boolean, default: false },      // 기차 레이드 여부
  trainKey: { type: String, default: null },       // 프리셋 키 (예: "1680_3")
  trainLabel: { type: String, default: null },     // "1680 노노하 3종 기차"
  trainRaids: [{                                   // 기차 구성 레이드 목록
    raidAlias: String,
    raidTag: String,
    raidName: String,
    difficulty: String,
    maxPlayers: Number,
    order: Number,
  }],

  // 스케줄러
  dmSent: { type: Boolean, default: false },                     // DM 발송 여부
  voiceChannelId: { type: String, default: null },               // 생성된 음성채널 ID
  voiceChannelCreatedAt: { type: Date, default: null },          // 음성채널 생성 시각 (스케줄러 삭제용)
  notifyMinutesBefore: { type: Number, enum: [10, 20, 30], default: 30 }, // 알림 타이밍
}, {
  timestamps: true
})

export default mongoose.models.Raid || mongoose.model("Raid", RaidSchema)
