import { connectDB } from "@/lib/mongodb"
import Raid from "@/lib/models/Raid"
import mongoose from "mongoose"

// TrainRaid 컬렉션에서 직접 읽기 위한 임시 스키마 (strict:false)
const TrainRaidSchema = new mongoose.Schema({}, { strict: false, collection: "trainraids" })
const TempTrainRaid = mongoose.models.TempTrainRaid || mongoose.model("TempTrainRaid", TrainRaidSchema)

// GET /api/admin/migrate-train-raids?secret=...
// trainraids 컬렉션의 모든 문서를 raids 컬렉션으로 복사 (isTrain:true 추가)
// ※ 마이그레이션 완료 후 MongoDB Atlas에서 trainraids 컬렉션을 수동 삭제하세요.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  if (searchParams.get("secret") !== process.env.SCHEDULER_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  await connectDB()

  const trainRaids = await TempTrainRaid.find({}).lean()

  if (trainRaids.length === 0) {
    return Response.json({ ok: true, migrated: 0, message: "trainraids 컬렉션이 비어 있습니다." })
  }

  const results = { migrated: 0, skipped: 0, errors: [] }

  for (const doc of trainRaids) {
    const _id = doc._id

    // 이미 Raid 컬렉션에 같은 _id가 있으면 스킵
    const exists = await Raid.findById(_id)
    if (exists) {
      results.skipped++
      continue
    }

    try {
      const firstRaid = doc.trainRaids?.[0] || {}
      await Raid.create({
        _id,
        isTrain:    true,
        trainKey:   doc.trainKey   || null,
        trainLabel: doc.trainLabel || "",
        trainRaids: (doc.trainRaids || []).map(r => ({
          order:      r.order,
          raidAlias:  r.raidAlias  || "",
          raidTag:    r.raidTag    || "",
          raidName:   r.raidName   || "",
          difficulty: r.difficulty || "",
          maxPlayers: r.maxPlayers || 0,
        })),
        // Raid 스키마 필수 필드 (첫 번째 레이드 기준)
        raidName:   firstRaid.raidName  || doc.trainLabel || "",
        raidAlias:  firstRaid.raidAlias || doc.trainLabel || "",
        raidTag:    firstRaid.raidTag   || "",
        difficulty: firstRaid.difficulty || "",
        // 공통 필드
        maxPlayers:       doc.maxPlayers       || 8,
        isMobaChul:       doc.isMobaChul       || false,
        date:             doc.date             || "",
        time:             doc.time             || "",
        discordChannelId: doc.discordChannelId || null,
        discordMessageId: doc.discordMessageId || null,
        guildId:          doc.guildId          || null,
        hostId:           doc.hostId           || "",
        hostName:         doc.hostName         || "",
        hostImage:        doc.hostImage        || null,
        participants:     (doc.participants || []).map(p => ({
          userId:               p.userId,
          userName:             p.userName,
          userImage:            p.userImage,
          role:                 p.role,
          characterName:        p.characterName        || null,
          characterClass:       p.characterClass       || null,
          characterLevel:       p.characterLevel       || null,
          characterCombatPower: p.characterCombatPower || null,
          joinedAt:             p.joinedAt || new Date(),
        })),
        status:               doc.status               || "모집중",
        dmSent:               doc.dmSent               || false,
        voiceChannelId:       doc.voiceChannelId       || null,
        voiceChannelCreatedAt:doc.voiceChannelCreatedAt|| null,
        notifyMinutesBefore:  doc.notifyMinutesBefore  || 30,
        createdAt:            doc.createdAt || new Date(),
        updatedAt:            doc.updatedAt || new Date(),
      })
      results.migrated++
    } catch (e) {
      results.errors.push({ id: _id.toString(), error: e.message })
    }
  }

  return Response.json({
    ok: true,
    total: trainRaids.length,
    migrated: results.migrated,
    skipped: results.skipped,
    errors: results.errors,
    message: results.errors.length === 0
      ? `✅ ${results.migrated}개 마이그레이션 완료. MongoDB Atlas에서 trainraids 컬렉션을 수동 삭제하세요.`
      : `⚠️ ${results.migrated}개 완료, ${results.errors.length}개 실패.`,
  })
}
