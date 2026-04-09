import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

const DISCORD_API = "https://discord.com/api/v10"

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { channelId } = await request.json()
  if (!channelId) return Response.json({ error: "channelId 필요" }, { status: 400 })

  const token = process.env.DISCORD_BOT_TOKEN

  const embed = {
    title: "⚔️ 레이드 모집 생성",
    description: "아래 버튼을 눌러 레이드 모집을 시작하세요.",
    color: 0x9B59B6,
    footer: { text: "LostArk Guide · 레이드 모집 시스템" },
  }

  const components = [{
    type: 1,
    components: [
      { type: 2, style: 1, label: "⚔️ 단일 레이드 생성", custom_id: "raid_create_start" },
      { type: 2, style: 2, label: "🚂 기차 레이드 생성", custom_id: "train_create_start" },
    ],
  }]

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed], components }),
  })

  if (!res.ok) {
    const data = await res.json()
    return Response.json({ error: data.message }, { status: 500 })
  }

  const charEmbed = {
    title: "🛡️ 캐릭터 인증 시스템",
    description: [
      "아래 버튼을 선택하여 원하는 기능을 이용해주세요.",
      "",
      "✅ **캐릭터 인증** - 대표캐릭터명으로 원정대 등록",
      "✏️ **캐릭터 변경** - 등록된 대표캐릭터명 변경",
      "❌ **인증 제거** - 등록된 캐릭터 정보 삭제",
      "",
      "📋 **안내**",
      "캐릭터를 인증하면 레이드 참가 시",
      "캐릭터 정보(직업/레벨)와 함께 참가할 수 있습니다.",
      "레이드 입장 레벨에 맞는 캐릭터만 조회됩니다.",
    ].join("\n"),
    color: 0x3498DB,
  }

  const charComponents = [{
    type: 1,
    components: [
      { type: 2, style: 3, label: "✅ 캐릭터 인증", custom_id: "char_auth_register" },
      { type: 2, style: 1, label: "✏️ 캐릭터 변경", custom_id: "char_auth_update" },
      { type: 2, style: 4, label: "❌ 인증 제거",   custom_id: "char_auth_remove" },
    ],
  }]

  await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [charEmbed], components: charComponents }),
  })

  return Response.json({ success: true })
}
