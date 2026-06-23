require('dotenv').config()
const WebSocket = require('ws')
const mongoose = require('mongoose')

// ── 설정 ────────────────────────────────────────────────────────────────────
const DISCORD_API     = 'https://discord.com/api/v10'
const DISCORD_GATEWAY = 'wss://gateway.discord.gg/?v=10&encoding=json'
const BOT_TOKEN       = process.env.DISCORD_BOT_TOKEN
const MONGODB_URI     = process.env.MONGODB_URI

if (!BOT_TOKEN)    { console.error('[FATAL] DISCORD_BOT_TOKEN 없음'); process.exit(1) }
if (!MONGODB_URI)  { console.error('[FATAL] MONGODB_URI 없음');        process.exit(1) }

// ── Raid 모델 (필요한 필드만, strict: false로 나머지 무시) ────────────────
const RaidSchema = new mongoose.Schema(
  {
    guildId:              String,
    voiceChannelId:       { type: String,  default: null },
    voiceChannelCreatedAt:{ type: Date,    default: null },
  },
  { strict: false, collection: 'raids' }
)
const Raid = mongoose.models.Raid || mongoose.model('Raid', RaidSchema)

// ── UserCharacters 모델 ───────────────────────────────────────────────────────
const UserCharactersSchema = new mongoose.Schema(
  { discordId: String, accounts: Array, characters: Array },
  { strict: false, collection: 'usercharacters' }
)
const UserCharacters = mongoose.models.UserCharacters
  || mongoose.model('UserCharacters', UserCharactersSchema)

// ── 로아 API 헬퍼 ────────────────────────────────────────────────────────────
const LOSTARK_API = 'https://developer-lostark.game.gg'

async function fetchCharacterSiblings(name) {
  const res = await fetch(
    `${LOSTARK_API}/characters/${encodeURIComponent(name)}/siblings`,
    {
      headers: {
        Authorization: `bearer ${process.env.LOSTARK_API_KEY}`,
        Accept: 'application/json',
      },
    }
  )
  if (!res.ok) return null
  return res.json()
}

async function fetchCombatPower(name) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(
      `${LOSTARK_API}/armories/characters/${encodeURIComponent(name)}?filters=profiles`,
      {
        headers: {
          Authorization: `bearer ${process.env.LOSTARK_API_KEY}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    )
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = await res.json()
    return data?.ArmoryProfile?.CombatPower
      ? parseFloat(data.ArmoryProfile.CombatPower.replace(/,/g, ''))
      : null
  } catch {
    return null
  }
}

async function fetchAndBuildCharacters(representativeName) {
  const siblings = await fetchCharacterSiblings(representativeName)
  if (!siblings) return null

  const characters = []
  for (const char of siblings) {
    const level = parseFloat(
      (char.ItemAvgLevel || '0').replace(/,/g, '')
    )
    if (level < 1680) continue

    await new Promise(r => setTimeout(r, 200))

    const combatPower = await fetchCombatPower(char.CharacterName)
    characters.push({
      name: char.CharacterName,
      class: char.CharacterClassName,
      level,
      combatPower,
      server: char.ServerName,
    })
  }
  return characters
}

// ── 캐릭터 자동 갱신 ──────────────────────────────────────────────────────────
async function refreshAllCharacters() {
  if (!process.env.LOSTARK_API_KEY) {
    console.log('[CharRefresh] LOSTARK_API_KEY 없음, 건너뜀')
    return
  }

  console.log('[CharRefresh] 주간 캐릭터 자동 갱신 시작')
  const allUsers = await UserCharacters.find({})
  let updatedCount = 0
  let failedCount = 0

  for (const userChar of allUsers) {
    try {
      const obj = userChar.toObject()
      let representativeName = null

      if (obj.accounts?.length > 0) {
        representativeName = obj.accounts[0]?.characters?.[0]?.name
      } else {
        representativeName = obj.characters?.[0]?.name
      }

      if (!representativeName) continue

      const newChars = await fetchAndBuildCharacters(representativeName)
      if (!newChars || newChars.length === 0) {
        failedCount++
        continue
      }

      if (obj.accounts?.length > 0) {
        const updatedAccounts = obj.accounts.map((acc, i) => {
          if (i === 0) return { ...acc, characters: newChars }
          return acc
        })
        await UserCharacters.findByIdAndUpdate(userChar._id, {
          accounts: updatedAccounts,
          characters: newChars,
        })
      } else {
        await UserCharacters.findByIdAndUpdate(userChar._id, {
          characters: newChars,
        })
      }

      updatedCount++
      console.log(`[CharRefresh] ${userChar.discordId} 갱신 완료 (${newChars.length}개)`)
    } catch (e) {
      console.error(`[CharRefresh] ${userChar.discordId} 실패:`, e.message)
      failedCount++
    }

    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`[CharRefresh] 완료 — 성공: ${updatedCount}, 실패: ${failedCount}`)
}

let lastCharRefreshDate = null

async function checkCharRefresh() {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  const day = kst.getDay()
  const hour = kst.getHours()
  const min = kst.getMinutes()
  const todayStr = kst.toISOString().slice(0, 10)

  const isWedMidnight = day === 3 && hour === 0 && min < 10
  if (isWedMidnight && lastCharRefreshDate !== todayStr) {
    lastCharRefreshDate = todayStr
    await refreshAllCharacters()
  }
}

// ── 음성 상태 추적 (메모리) ──────────────────────────────────────────────────
// voiceStateMap : channelId  → Set<userId>  (채널에 현재 있는 유저)
// userChannelMap: userId     → channelId    (유저가 현재 있는 채널)
const voiceStateMap  = new Map()
const userChannelMap = new Map()

// ── WebSocket 상태 ────────────────────────────────────────────────────────────
let ws                = null
let heartbeatInterval = null
let reconnectTimeout  = null
let lastSequence      = null

// ── MongoDB 연결 ─────────────────────────────────────────────────────────────
async function connectDB() {
  if (mongoose.connection.readyState === 1) return
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4, // IPv4 강제
  })
  console.log('[DB] MongoDB 연결 완료')
}

// ── 음성채널 빈 채널 감지 + 삭제 ─────────────────────────────────────────────
async function checkAndDeleteIfEmpty(channelId, guildId) {
  const users = voiceStateMap.get(channelId)

  // 채널에 아직 유저가 있으면 무시
  if (!users || users.size > 0) return

  try {
    // 해당 voiceChannelId를 가진 레이드 조회 (단일/기차 모두 Raid 컬렉션)
    const raid = await Raid.findOne({ guildId, voiceChannelId: channelId })
    if (!raid) return // 일반 음성채널이면 무시

    console.log(`[VOICE] 채널 ${channelId} 비어있음 → 삭제 시도`)

    const res = await fetch(`${DISCORD_API}/channels/${channelId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bot ${BOT_TOKEN}` },
    })

    if (!res.ok && res.status !== 404) {
      const err = await res.json().catch(() => ({}))
      console.error(`[VOICE] 채널 삭제 실패: ${res.status}`, err.message || '')
    }
    // 성공(200) / 이미 삭제됨(404) / 기타 오류 모두 DB는 항상 정리
    await Raid.findByIdAndUpdate(raid._id, {
      voiceChannelId:        null,
      voiceChannelCreatedAt: null,
    })
    voiceStateMap.delete(channelId)
    const label = raid.isTrain ? (raid.trainLabel || 'N종 레이드') : `raid: ${raid._id}`
    console.log(`[VOICE] 채널 ${channelId} 처리 완료 (${label})`)
  } catch (e) {
    console.error('[VOICE] 삭제 중 오류:', e.message)
  }
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────
function sendHeartbeat() {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ op: 1, d: lastSequence }))
  }
}

// ── IDENTIFY ──────────────────────────────────────────────────────────────────
function identify() {
  ws.send(JSON.stringify({
    op: 2,
    d: {
      token:    BOT_TOKEN,
      intents:  128, // GUILD_VOICE_STATES (1 << 7)
      properties: { os: 'linux', browser: 'bot', device: 'bot' },
    },
  }))
}

// ── 재연결 스케줄 ──────────────────────────────────────────────────────────────
function scheduleReconnect(delay = 5000) {
  if (reconnectTimeout) clearTimeout(reconnectTimeout)
  reconnectTimeout = setTimeout(() => connect(), delay)
}

// ── Gateway 연결 ──────────────────────────────────────────────────────────────
function connect() {
  // 기존 연결 정리
  if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null }
  if (ws) { ws.removeAllListeners(); try { ws.close() } catch (_) {} }

  console.log('[GW] Discord Gateway 연결 중...')
  ws = new WebSocket(DISCORD_GATEWAY)

  ws.on('open', () => {
    console.log('[GW] WebSocket 연결 완료')
  })

  ws.on('message', async (raw) => {
    const payload = JSON.parse(raw)
    const { op, d, s, t } = payload

    if (s != null) lastSequence = s

    switch (op) {
      // op 10: HELLO → heartbeat 시작 + IDENTIFY
      case 10: {
        const interval = d.heartbeat_interval
        // 첫 heartbeat는 jitter 적용 (Discord 권장)
        setTimeout(() => {
          sendHeartbeat()
          heartbeatInterval = setInterval(sendHeartbeat, interval)
        }, Math.floor(interval * Math.random()))
        identify()
        console.log(`[GW] HELLO 수신 — heartbeat ${interval}ms 간격 설정`)
        break
      }
      // op 1: Discord가 즉시 Heartbeat 요청
      case 1:
        sendHeartbeat()
        break
      // op 11: Heartbeat ACK → 정상 (별도 처리 불필요)
      case 11:
        break
      // op 7: RECONNECT 요청
      case 7:
        console.log('[GW] RECONNECT 요청 수신')
        scheduleReconnect(0)
        break
      // op 9: INVALID_SESSION
      case 9:
        console.log('[GW] INVALID_SESSION — 5초 후 재연결')
        scheduleReconnect(5000)
        break
      // op 0: Dispatch (실제 이벤트)
      case 0:
        await handleDispatch(t, d)
        break
    }
  })

  ws.on('close', (code) => {
    console.log(`[GW] 연결 종료 (code: ${code})`)
    clearInterval(heartbeatInterval)
    heartbeatInterval = null
    // 정상 종료(1000, 1001)가 아니면 자동 재연결
    if (code !== 1000 && code !== 1001) {
      console.log('[GW] 비정상 종료 — 5초 후 재연결')
      scheduleReconnect(5000)
    }
  })

  ws.on('error', (err) => {
    console.error('[GW] WebSocket 오류:', err.message)
  })
}

// ── Dispatch 이벤트 핸들러 ─────────────────────────────────────────────────────
async function handleDispatch(t, d) {
  switch (t) {
    case 'READY':
      console.log(`[GW] READY — 봇: ${d.user?.username}`)
      break

    // GUILD_CREATE: 시작 시 현재 음성 상태 전체 초기화
    case 'GUILD_CREATE': {
      let count = 0
      for (const vs of d.voice_states || []) {
        if (!vs.channel_id) continue
        if (!voiceStateMap.has(vs.channel_id)) {
          voiceStateMap.set(vs.channel_id, new Set())
        }
        voiceStateMap.get(vs.channel_id).add(vs.user_id)
        userChannelMap.set(vs.user_id, vs.channel_id)
        count++
      }
      if (count > 0) {
        console.log(`[GW] GUILD_CREATE (${d.id}): 음성 상태 ${count}건 초기화`)
      }
      break
    }

    // VOICE_STATE_UPDATE: 유저 입퇴장 추적 → 빈 채널 감지
    case 'VOICE_STATE_UPDATE': {
      const { user_id, channel_id, guild_id } = d

      // 이전 채널에서 유저 제거
      const oldChannelId = userChannelMap.get(user_id)
      if (oldChannelId) {
        voiceStateMap.get(oldChannelId)?.delete(user_id)
      }

      if (channel_id) {
        // 새 채널에 유저 추가 (채널 이동)
        if (!voiceStateMap.has(channel_id)) {
          voiceStateMap.set(channel_id, new Set())
        }
        voiceStateMap.get(channel_id).add(user_id)
        userChannelMap.set(user_id, channel_id)
      } else {
        // 음성채널 퇴장 (channel_id === null)
        userChannelMap.delete(user_id)

        // 이전 채널이 레이드 채널이고 비어있으면 삭제
        if (oldChannelId && guild_id) {
          await checkAndDeleteIfEmpty(oldChannelId, guild_id)
        }
      }
      break
    }
  }
}

// ── 스케줄러 (5분마다 scheduler/check API 호출) ────────────────────────────────
async function runScheduler() {
  try {
    const res = await fetch(
      `${process.env.NEXTAUTH_URL}/api/scheduler/check?secret=${process.env.SCHEDULER_SECRET}`
    )
    const data = await res.json()
    console.log('[Scheduler]', new Date().toLocaleString('ko-KR'), data)
  } catch (e) {
    console.error('[Scheduler] 호출 실패:', e.message)
  }
}

// ── 진입점 ─────────────────────────────────────────────────────────────────────
async function main() {
  await connectDB()
  connect()
  // 시작 시 즉시 1회 실행 + 5분마다 반복
  runScheduler()
  setInterval(runScheduler, 5 * 60 * 1000)
  checkCharRefresh()
  setInterval(checkCharRefresh, 5 * 60 * 1000)

  // 임시 테스트 - 확인 후 삭제
  setTimeout(async () => {
    console.log('[Network TEST] 구글 연결 테스트')
    try {
      const res = await fetch('https://www.google.com')
      console.log('[Network TEST] 구글 응답 status:', res.status)
    } catch (e) {
      console.error('[Network TEST] 구글 실패:', e.message)
    }
  }, 10000)
}

main().catch(err => {
  console.error('[FATAL]', err)
  process.exit(1)
})
