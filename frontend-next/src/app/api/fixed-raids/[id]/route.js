import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import FixedRaid from "@/lib/models/FixedRaid"
import { SUPPORTER_CLASSES } from "@/lib/lostarkData"

const DISCORD_API = "https://discord.com/api/v10"

async function checkAdminPermission(guildId, userId) {
  const token = process.env.DISCORD_BOT_TOKEN
  const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${token}` },
  })
  if (!res.ok) return false
  const member = await res.json()
  const perms = BigInt(member.permissions || "0")
  return (perms & BigInt(0x8)) === BigInt(0x8)
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.discordId || session.user.id

    await connectDB()
    const existing = await FixedRaid.findById(id)
    if (!existing) return Response.json({ error: "고정 레이드를 찾을 수 없습니다." }, { status: 404 })

    const isAdmin = await checkAdminPermission(existing.guildId, userId)
    if (!isAdmin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })

    const body = await request.json()

    // slots 업데이트 시 서포터 슬롯에 딜러 직업 배치 방지
    if (body.slots) {
      for (const slot of body.slots) {
        if (slot.isSupporter && slot.characterClass && !SUPPORTER_CLASSES.includes(slot.characterClass)) {
          return Response.json(
            { error: `슬롯 ${slot.slotIndex}은 서포터 전용 슬롯입니다.` },
            { status: 400 }
          )
        }
        // isSupporter 필드는 기존 값 유지 (4번, 8번 고정)
        const originalSlot = existing.slots.find(s => s.slotIndex === slot.slotIndex)
        if (originalSlot) slot.isSupporter = originalSlot.isSupporter
      }
    }

    const { guildId: _g, ...updateFields } = body
    const fixedRaid = await FixedRaid.findByIdAndUpdate(id, { $set: updateFields }, { new: true })
    return Response.json({ fixedRaid })
  } catch (e) {
    console.error("[fixed-raids PUT]", e.message)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.discordId || session.user.id

    await connectDB()
    const existing = await FixedRaid.findById(id)
    if (!existing) return Response.json({ error: "고정 레이드를 찾을 수 없습니다." }, { status: 404 })

    const isAdmin = await checkAdminPermission(existing.guildId, userId)
    if (!isAdmin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 })

    await FixedRaid.findByIdAndDelete(id)
    return Response.json({ ok: true })
  } catch (e) {
    console.error("[fixed-raids DELETE]", e.message)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
