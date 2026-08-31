"use client"

import { useEffect } from "react"

export default function GuildPillSelector({
  guilds,
  loadingGuilds,
  selectedGuildId,
  onSelect,
  d,
  autoSelectFirst = true,
}) {
  useEffect(() => {
    if (!autoSelectFirst || loadingGuilds || selectedGuildId) return
    if (guilds.length === 0) return
    onSelect(guilds[0].id)
  }, [autoSelectFirst, loadingGuilds, guilds, selectedGuildId, onSelect])

  if (guilds.length === 0) return null

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
      {guilds.map(guild => {
        const isSelected = selectedGuildId === guild.id
        return (
          <button
            key={guild.id}
            onClick={() => onSelect(guild.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border whitespace-nowrap flex-shrink-0 transition-colors text-sm
              ${isSelected
                ? d ? "bg-amber-500/10 border-amber-500/30 text-amber-400 font-medium" : "bg-purple-600 border-purple-600 text-white font-medium"
                : d ? "bg-white/[0.03] border-white/10 text-gray-400 hover:border-white/20 hover:text-white" : "bg-white border-purple-100 text-gray-600 hover:border-purple-300 hover:text-gray-800"
              }`}>
            {guild.icon ? (
              <img src={guild.icon} alt={guild.name} className="w-5 h-5 rounded-full" />
            ) : (
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                ${isSelected
                  ? d ? "bg-amber-500/20 text-amber-400" : "bg-white/20 text-white"
                  : d ? "bg-white/10 text-gray-400" : "bg-purple-100 text-purple-600"
                }`}>
                {guild.name[0]}
              </div>
            )}
            {guild.name}
          </button>
        )
      })}
    </div>
  )
}
