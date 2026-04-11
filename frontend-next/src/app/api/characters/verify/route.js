import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import UserCharacters from "@/lib/models/UserCharacters"

const LOSTARK_API = "https://developer-lostark.game.onstove.com"

// ── IP 기반 Rate Limit (POST /api/characters/verify: 1분에 5회) ──
const verifyRateLimit = new Map()

function checkVerifyRateLimit(ip) {
  const now = Date.now()
  const windowMs = 60_000
  const maxRequests = 5
  const entry = verifyRateLimit.get(ip)
  if (!entry || now - entry.start > windowMs) {
    verifyRateLimit.set(ip, { start: now, count: 1 })
    return false
  }
  entry.count++
  return entry.count > maxRequests
}

export async function POST(request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? request.headers.get("x-real-ip")
      ?? "unknown"
    if (checkVerifyRateLimit(ip)) {
      return Response.json(
        { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        { status: 429 }
      )
    }

    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const discordId = session.user.discordId || session.user.id

    const { characterName } = await request.json()
    if (!characterName?.trim()) {
      return Response.json({ error: "캐릭터명을 입력해주세요." }, { status: 400 })
    }

    // 로아 API 호출
    const encoded = encodeURIComponent(characterName.trim())
    const res = await fetch(`${LOSTARK_API}/characters/${encoded}/siblings`, {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${process.env.LOSTARK_API_KEY}`,
      },
    })

    if (res.status === 404 || res.status === 204) {
      return Response.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 })
    }
    if (!res.ok) {
      return Response.json({ error: `LoA API 오류: ${res.status}` }, { status: 502 })
    }

    const data = await res.json()
    if (!data || data.length === 0) {
      return Response.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 })
    }

    const baseChars = data.map(c => ({
      name:         c.CharacterName,
      class:        c.CharacterClassName,
      level:        parseFloat(c.ItemAvgLevel.replace(/,/g, "")),
      server:       c.ServerName,
      combatPower:  null,
    }))

    // 캐릭터마다 armories API로 전투력 조회 (rate limit 방지: 200ms 간격)
    const characters = []
    for (const char of baseChars) {
      let combatPower = null
      try {
        const controller = new AbortController()
        const tid = setTimeout(() => controller.abort(), 5000)
        const armRes = await fetch(
          `${LOSTARK_API}/armories/characters/${encodeURIComponent(char.name)}?filters=profiles`,
          {
            headers: {
              accept: "application/json",
              authorization: `Bearer ${process.env.LOSTARK_API_KEY}`,
            },
            signal: controller.signal,
          }
        )
        clearTimeout(tid)
        if (armRes.ok) {
          const armData = await armRes.json()
          const combatPowerRaw = armData?.ArmoryProfile?.CombatPower
          combatPower = combatPowerRaw
            ? Math.round(parseFloat(combatPowerRaw.replace(/,/g, "")))
            : null
        }
      } catch {
        // armories 실패 시 combatPower: null 유지
      }
      characters.push({ ...char, combatPower })
      await new Promise(r => setTimeout(r, 200))
    }

    await connectDB()
    await UserCharacters.findOneAndUpdate(
      { discordId },
      {
        discordId,
        representCharacter: characterName.trim(),
        characters,
        verifiedAt: new Date(),
        lastSyncAt: new Date(),
      },
      { upsert: true, new: true }
    )

    return Response.json({ ok: true, characters })
  } catch (e) {
    console.error("[characters/verify]", e.message)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
