require('dotenv').config({ path: '.env.local' })

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const APPLICATION_ID = process.env.DISCORD_APPLICATION_ID || process.env.DISCORD_CLIENT_ID

if (!BOT_TOKEN || !APPLICATION_ID) {
  console.error('❌ DISCORD_BOT_TOKEN 또는 DISCORD_APPLICATION_ID(DISCORD_CLIENT_ID) 환경변수가 없습니다.')
  process.exit(1)
}

const RAID_CHOICES = [
  { name: "에키드나",   value: "에키드나" },
  { name: "에기르",     value: "에기르" },
  { name: "아브렐슈드", value: "아브렐슈드" },
  { name: "모르둠",     value: "모르둠" },
  { name: "아르모체",   value: "아르모체" },
  { name: "카제로스",   value: "카제로스" },
  { name: "세르카",     value: "세르카" },
  { name: "지평의성당", value: "지평의성당" },
]

const SKILL_CHOICES = [
  { name: "헤딩", value: "헤딩" },
  { name: "트라이", value: "트라이" },
  { name: "클경", value: "클경" },
  { name: "반숙", value: "반숙" },
  { name: "숙련", value: "숙련" },
  { name: "숙제", value: "숙제" },
]

const CHAR_OPTIONS = (n) => ({
  name: `캐릭터${n}`,
  description: `참가할 캐릭터 ${n} (${n}수)`,
  type: 3,
  required: false,
  autocomplete: true,
})

const commands = [
  {
    name: "모집",
    description: "레이드 모집을 생성합니다",
    options: [
      { name: "레이드",   description: "레이드 종류",        type: 3, required: true, choices: RAID_CHOICES },
      { name: "난이도",   description: "레이드 난이도",       type: 3, required: true, autocomplete: true },
      { name: "숙련도",   description: "파티 숙련도 요구사항", type: 3, required: true, choices: SKILL_CHOICES },
      { name: "날짜",     description: "YYYY-MM-DD",         type: 3, required: true },
      { name: "시간",     description: "HH:MM",              type: 3, required: true },
      { name: "n수",      description: "몇 수 레이드인지 (1~4)", type: 4, required: true, min_value: 1, max_value: 4 },
      CHAR_OPTIONS(1), CHAR_OPTIONS(2), CHAR_OPTIONS(3), CHAR_OPTIONS(4),
    ],
  },
  {
    name: "모바출모집",
    description: "모바일 출발 레이드 모집을 생성합니다",
    options: [
      { name: "레이드",   description: "레이드 종류",        type: 3, required: true, choices: RAID_CHOICES },
      { name: "난이도",   description: "레이드 난이도",       type: 3, required: true, autocomplete: true },
      { name: "숙련도",   description: "파티 숙련도 요구사항", type: 3, required: true, choices: SKILL_CHOICES },
      { name: "n수",      description: "몇 수 레이드인지 (1~4)", type: 4, required: true, min_value: 1, max_value: 4 },
      CHAR_OPTIONS(1), CHAR_OPTIONS(2), CHAR_OPTIONS(3), CHAR_OPTIONS(4),
    ],
  },
  {
    name: "참가",
    description: "레이드에 참가합니다",
    options: [
      { name: "레이드id", description: "Discord 메시지 footer의 ID", type: 3, required: true },
      { name: "캐릭터",   description: "참가할 캐릭터 (1수)",          type: 3, required: true, autocomplete: true },
      { name: "캐릭터2",  description: "참가할 캐릭터 (2수)",          type: 3, required: false, autocomplete: true },
      { name: "캐릭터3",  description: "참가할 캐릭터 (3수)",          type: 3, required: false, autocomplete: true },
      { name: "캐릭터4",  description: "참가할 캐릭터 (4수)",          type: 3, required: false, autocomplete: true },
    ],
  },
  {
    name: "같이참가",
    description: "깐부와 함께 레이드에 참가합니다",
    options: [
      { name: "레이드id",    description: "Discord 메시지 footer의 ID",   type: 3, required: true },
      { name: "내캐릭터1",  description: "내 1수 캐릭터",                  type: 3, required: true,  autocomplete: true },
      { name: "같이참가유저", description: "함께 참가할 유저",              type: 6, required: true },
      { name: "유저캐릭터1", description: "상대방 1수 캐릭터명",            type: 3, required: true,  autocomplete: true },
      { name: "내캐릭터2",  description: "내 2수 캐릭터 (N수 레이드)",      type: 3, required: false, autocomplete: true },
      { name: "유저캐릭터2", description: "상대방 2수 캐릭터명",            type: 3, required: false, autocomplete: true },
      { name: "내캐릭터3",  description: "내 3수 캐릭터 (N수 레이드)",      type: 3, required: false, autocomplete: true },
      { name: "유저캐릭터3", description: "상대방 3수 캐릭터명",            type: 3, required: false, autocomplete: true },
      { name: "내캐릭터4",  description: "내 4수 캐릭터 (N수 레이드)",      type: 3, required: false, autocomplete: true },
      { name: "유저캐릭터4", description: "상대방 4수 캐릭터명",            type: 3, required: false, autocomplete: true },
    ],
  },
  {
    name: "지난레이드삭제",
    description: "기한이 지난 레이드 모집을 삭제합니다 (관리자: 전체, 일반: 본인 것만)",
    options: [],
  },
]

async function registerCommands() {
  const url = `https://discord.com/api/v10/applications/${APPLICATION_ID}/commands`
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  })

  if (!res.ok) {
    const err = await res.json()
    console.error("❌ 커맨드 등록 실패:", JSON.stringify(err, null, 2))
    process.exit(1)
  }

  const data = await res.json()
  console.log(`✅ ${data.length}개 슬래시 커맨드 등록 완료:`)
  data.forEach(cmd => console.log(`  /${cmd.name} (id: ${cmd.id})`))
}

registerCommands().catch(e => {
  console.error("❌ 오류:", e.message)
  process.exit(1)
})
