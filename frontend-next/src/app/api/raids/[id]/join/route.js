import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"
import { updateDiscordMessage, sendDepartDMs } from "@/lib/discord"

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { role, roundSelections } = body

    await connectDB()
    const raid = await Raid.findById(id)

    if (!raid) {
      return Response.json({ error: "레이드를 찾을 수 없습니다" }, { status: 404 })
    }

    const userId = session.user.discordId || session.user.id

    // ── N수 레이드 참가 ──────────────────────────────────────────────────────
    if (roundSelections && Array.isArray(roundSelections)) {
      if (!raid.totalRounds || raid.totalRounds < 2) {
        return Response.json({ error: "N수 레이드가 아닙니다" }, { status: 400 })
      }
      if (raid.status !== "모집중") {
        return Response.json({ error: "모집이 마감된 레이드입니다" }, { status: 400 })
      }

      const alreadyInAnyRound = raid.rounds.some(r =>
        r.participants.some(p => p.userId === userId)
      )
      if (alreadyInAnyRound) {
        return Response.json({ error: "이미 참가 신청한 레이드입니다" }, { status: 400 })
      }
      if (roundSelections.length !== raid.totalRounds) {
        return Response.json({ error: "모든 수의 캐릭터를 선택해주세요" }, { status: 400 })
      }

      const charNames = roundSelections.map(s => s.characterName)
      const hasDuplicate = charNames.length !== new Set(charNames).size
      if (hasDuplicate) {
        return Response.json(
          { error: "같은 캐릭터를 여러 수에 배치할 수 없습니다" },
          { status: 400 }
        )
      }

      const supporterSlots = raid.maxPlayers / 4
      const dealerSlots = raid.maxPlayers - supporterSlots

      for (const sel of roundSelections) {
        const round = raid.rounds.find(r => r.order === sel.order)
        if (!round) {
          return Response.json({ error: `${sel.order}수 데이터가 없습니다` }, { status: 400 })
        }

        const roundDealers = round.participants.filter(p => p.role === "dealer")
        const roundSupporters = round.participants.filter(p => p.role === "support")

        if (sel.role === "dealer" && roundDealers.length >= dealerSlots) {
          return Response.json({ error: `${sel.order}수 딜러 자리가 꽉 찼습니다` }, { status: 400 })
        }
        if (sel.role === "support" && roundSupporters.length >= supporterSlots) {
          return Response.json({ error: `${sel.order}수 서포터 자리가 꽉 찼습니다` }, { status: 400 })
        }

        if (sel.role === "dealer" && raid.maxPlayers === 4) {
          const existing = new Set(roundDealers.map(p => p.characterClass).filter(Boolean))
          if (existing.has(sel.characterClass)) {
            return Response.json({ error: `${sel.order}수에 ${sel.characterClass}가 이미 있습니다` }, { status: 400 })
          }
        }
        if (sel.role === "dealer" && raid.maxPlayers === 8) {
          const classCount = {}
          roundDealers.forEach(p => { if (p.characterClass) classCount[p.characterClass] = (classCount[p.characterClass] || 0) + 1 })
          if ((classCount[sel.characterClass] || 0) >= 2) {
            return Response.json({ error: `${sel.order}수에 ${sel.characterClass}가 이미 2명입니다` }, { status: 400 })
          }
        }

        round.participants.push({
          userId,
          userName: session.user.name,
          userImage: session.user.image,
          role: sel.role,
          characterName: sel.characterName || null,
          characterClass: sel.characterClass || null,
          characterLevel: sel.characterLevel || null,
          characterCombatPower: sel.characterCombatPower || null,
        })
      }

      const allFull = raid.rounds.every(r => {
        const d = r.participants.filter(p => p.role === "dealer").length
        const s = r.participants.filter(p => p.role === "support").length
        return d >= dealerSlots && s >= supporterSlots
      })
      if (allFull) raid.status = "모집완료"

      await raid.save()
      updateDiscordMessage(raid).catch(e => console.error("N수 Discord 업데이트 실패:", e))
      return Response.json({ success: true, raid })
    }

    // ── 기존 단일 레이드 참가 ───────────────────────────────────────────────
    if (!["dealer", "support"].includes(role)) {
      return Response.json({ error: "올바른 역할을 선택하세요" }, { status: 400 })
    }

    if (raid.status !== "모집중") {
      return Response.json({ error: "모집이 마감된 레이드입니다" }, { status: 400 })
    }

    const alreadyJoined = raid.participants.some(p => p.userId === userId)
    if (alreadyJoined) {
      return Response.json({ error: "이미 참가 신청한 레이드입니다" }, { status: 400 })
    }

    const supporterSlots = raid.maxPlayers / 4
    const dealerSlots = raid.maxPlayers - supporterSlots
    const dealers = raid.participants.filter(p => p.role === "dealer")
    const supporters = raid.participants.filter(p => p.role === "support")

    if (role === "dealer" && dealers.length >= dealerSlots) {
      return Response.json({ error: "딜러 자리가 꽉 찼습니다" }, { status: 400 })
    }
    if (role === "support" && supporters.length >= supporterSlots) {
      return Response.json({ error: "서포터 자리가 꽉 찼습니다" }, { status: 400 })
    }

    raid.participants.push({
      userId,
      userName: session.user.name,
      userImage: session.user.image,
      role,
    })

    const newDealers = raid.participants.filter(p => p.role === "dealer")
    const newSupporters = raid.participants.filter(p => p.role === "support")
    const isFull = newDealers.length >= dealerSlots && newSupporters.length >= supporterSlots

    if (isFull && raid.isMobaChul) {
      raid.status = "출발완료"
      await raid.save()
      await updateDiscordMessage(raid)
      await sendDepartDMs(raid)
    } else {
      if (isFull) raid.status = "모집완료"
      await raid.save()
      await updateDiscordMessage(raid)
    }

    return Response.json({ success: true, raid })

  } catch (error) {
    console.error(error)
    console.error("참가 신청 오류:", error)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
