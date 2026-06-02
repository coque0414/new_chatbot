import { connectDB } from "@/lib/mongodb"
import Donation from "@/lib/models/Donation"

const DISCORD_API = "https://discord.com/api/v10"

export async function POST(request) {
  try {
    const { secret, donationId } = await request.json()

    if (secret !== process.env.ADMIN_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!donationId) {
      return Response.json({ error: "donationId 필수" }, { status: 400 })
    }

    await connectDB()
    const donation = await Donation.findById(donationId)
    if (!donation) return Response.json({ error: "후원 내역을 찾을 수 없습니다." }, { status: 404 })
    if (donation.status === "confirmed") {
      return Response.json({ error: "이미 확인된 후원입니다." }, { status: 400 })
    }

    await Donation.findByIdAndUpdate(donationId, {
      status: "confirmed",
      confirmedAt: new Date(),
    })

    const dmChannel = await fetch(`${DISCORD_API}/users/@me/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: donation.discordId }),
    }).then(r => r.json())

    if (dmChannel.id) {
      await fetch(`${DISCORD_API}/channels/${dmChannel.id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: "☘️ **후원해주셔서 감사합니다!**\n\n보내주신 커피로 더 좋은 서비스로 보답하겠습니다.\n오늘도 좋은 하루 되세요! ☘️",
        }),
      })
    }

    return Response.json({ ok: true })
  } catch (e) {
    console.error("[donation confirm]", e.message)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
