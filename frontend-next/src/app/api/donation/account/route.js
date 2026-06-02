import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return Response.json({
    bank:          process.env.DONATION_BANK,
    accountNumber: process.env.DONATION_ACCOUNT_NUMBER,
    accountName:   process.env.DONATION_ACCOUNT_NAME,
  })
}
