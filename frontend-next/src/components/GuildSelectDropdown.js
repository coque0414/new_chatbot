"use client"

import { Hash } from "lucide-react"

export default function GuildSelectDropdown({
  guilds,
  loadingGuilds,
  selectedGuild,
  guildSettings,
  guildSettingsLoading,
  onGuildChange,
  d,
  inputClass,
}) {
  const announcementChannelId = guildSettings?.announcementChannelId || null
  const announcementChannelName = guildSettings?.announcementChannelName || null

  return (
    <div>
      <label className={`block text-sm font-medium mb-2 ${d ? "text-gray-300" : "text-gray-700"}`}>
        <Hash size={14} className="inline mr-1" />Discord 서버 *
      </label>
      <select
        value={selectedGuild?.id || ""}
        onChange={e => {
          const guild = guilds.find(g => g.id === e.target.value)
          onGuildChange(guild || null)
        }}
        className={inputClass}>
        <option value="">{loadingGuilds ? "서버 목록 불러오는 중..." : "서버를 선택하세요"}</option>
        {guilds.map(guild => (
          <option key={guild.id} value={guild.id}>{guild.name}</option>
        ))}
      </select>

      {selectedGuild && (
        <div className={`mt-2 px-4 py-3 rounded-xl border text-sm
          ${guildSettingsLoading
            ? d ? "border-white/10 text-gray-500" : "border-purple-100 text-gray-400"
            : announcementChannelId
              ? d ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-emerald-200 bg-emerald-50 text-emerald-700"
              : d ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-amber-200 bg-amber-50 text-amber-700"
          }`}>
          {guildSettingsLoading
            ? "공고 채널 정보 불러오는 중..."
            : announcementChannelId
              ? `📢 공고 채널: #${announcementChannelName || announcementChannelId}`
              : <span>⚠️ 봇 설정에서 공고 채널을 먼저 지정해주세요.{" "}
                  <a href="/bot-settings" className="underline font-medium">봇 설정으로 이동</a>
                </span>
          }
        </div>
      )}
    </div>
  )
}
