import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { connectDB } from "@/lib/mongodb"
import Donation from "@/lib/models/Donation"

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { senderName, amount, message } = await request.json()

    if (!senderName?.trim()) {
      return Response.json({ error: "입금자명을 입력해주세요." }, { status: 400 })
    }
    if (!amount || amount < 2000) {
      return Response.json({ error: "최소 후원 금액은 2,000원입니다." }, { status: 400 })
    }

    await connectDB()
    await Donation.create({
      discordId:   session.user.id,
      discordName: session.user.name,
      senderName:  senderName.trim(),
      amount,
      message:     message?.trim() || "",
    })

    return Response.json({ ok: true })
  } catch (e) {
    console.error("[donation POST]", e.message)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    if (searchParams.get("secret") !== process.env.ADMIN_SECRET) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    await connectDB()
    const donations = await Donation.find().sort({ createdAt: -1 })
    return Response.json({ donations })
  } catch (e) {
    console.error("[donation GET]", e.message)
    return Response.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
