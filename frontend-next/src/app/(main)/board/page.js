"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { ChevronLeft, ChevronRight } from "lucide-react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { getTheme } from "@/lib/themes"
import { weekRangeStrings, formatWeekLabel, formatDateLabel, groupRaidsByDate } from "@/lib/loaWeek"

export default function BoardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [themeId, setThemeId] = useState("dark")
  const [mounted, setMounted] = useState(false)
  const [guilds, setGuilds] = useState([])
  const [guildsLoading, setGuildsLoading] = useState(true)
  const [selectedGuildId, setSelectedGuildId] = useState(null)
  const [raids, setRaids] = useState([])
  const [raidsLoading, setRaidsLoading] = useState(false)
  const [weekOffset, setWeekOffset] = useState(0)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem("themeId")
    if (saved) setThemeId(saved)
  }, [])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem("themeId", themeId)
  }, [themeId, mounted])

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  useEffect(() => {
    if (status !== "authenticated") return
    fetch("/api/discord/guilds")
      .then(r => r.json())
      .then(data => {
        const list = data.guilds || []
        setGuilds(list)
        if (list.length > 0) setSelectedGuildId(list[0].id)
      })
      .catch(e => console.error("서버 목록 불러오기 실패:", e))
      .finally(() => setGuildsLoading(false))
  }, [status])

  const fetchRaids = async (guildId, offset) => {
    if (!guildId) return
    setRaidsLoading(true)
    const { weekStart, weekEnd } = weekRangeStrings(offset)
    try {
      const res = await fetch(
        `/api/raids?guildId=${guildId}&status=active&weekStart=${encodeURIComponent(weekStart)}&weekEnd=${encodeURIComponent(weekEnd)}`
      )
      const data = await res.json()
      setRaids(data.raids || [])
    } catch (e) {
      console.error("레이드 목록 불러오기 실패:", e)
    } finally {
      setRaidsLoading(false)
    }
  }

  useEffect(() => {
    if (selectedGuildId) fetchRaids(selectedGuildId, weekOffset)
  }, [selectedGuildId, weekOffset])

  const handleWeekChange = (delta) => {
    const newOffset = weekOffset + delta
    if (newOffset < 0) return
    setWeekOffset(newOffset)
  }

  const handleGuildSelect = (guildId) => {
    setSelectedGuildId(guildId)
  }

  if (!mounted || status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: getTheme(themeId).bg }}>
        <div className="text-sm animate-pulse" style={{ color: getTheme(themeId).subtext }}>로딩 중...</div>
      </div>
    )
  }

  if (!session) return null

  const theme = getTheme(themeId)
  const d = theme.isDark

  const isExpired = (raid) => {
    if (raid.isMobaChul) return false
    if (!raid.date || !raid.time) return false
    return new Date() > new Date(`${raid.date}T${raid.time}:00+09:00`)
  }

  const statusColor = {
    "모집중":   d ? "text-green-400 bg-green-400/10"  : "text-green-600 bg-green-50",
    "모집완료": d ? "text-blue-400 bg-blue-400/10"   : "text-blue-600 bg-blue-50",
    "출발완료": d ? "text-amber-400 bg-amber-400/10" : "text-amber-600 bg-amber-50",
    "취소":     d ? "text-gray-500 bg-gray-500/10"   : "text-gray-400 bg-gray-100",
  }

  const RaidCard = ({ raid }) => {
    const expired = isExpired(raid)
    const isDimmed = raid.status === "취소" || raid.status === "출발완료" || expired
    const supporterSlots = raid.maxPlayers / 4
    const dealerSlots = raid.maxPlayers - supporterSlots
    const dealers = raid.participants?.filter(p => p.role === "dealer") || []
    const supporters = raid.participants?.filter(p => p.role === "support") || []
    const isTrain = !!(raid.isTrain || raid.trainLabel)
    const href = `/raids/${raid._id}`

    return (
      <a href={href} className={`h-full block ${isDimmed ? "opacity-50 grayscale" : ""}`}>
        <Card className={`p-4 border cursor-pointer transition-all hover:scale-[1.01] h-full flex flex-col
          ${d ? "bg-white/[0.03] border-white/10 hover:border-white/20" : "bg-white border-purple-100 hover:border-purple-300 hover:shadow-sm"}`}>
          <div className="flex items-start justify-between mb-2">
            <p className={`text-sm font-bold ${d ? "text-white" : "text-gray-800"}`}>
              {isTrain ? raid.trainLabel : `${raid.raidAlias} ${raid.difficulty}`}
            </p>
            <div className="flex items-center gap-1">
              {expired && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d ? "text-gray-500 bg-gray-500/10" : "text-gray-400 bg-gray-100"}`}>
                  종료
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[raid.status]}`}>
                {raid.status}
              </span>
            </div>
          </div>
          {isTrain && raid.trainRaids?.length > 0 && (
            <p className={`text-xs mb-1 ${d ? "text-gray-400" : "text-gray-500"}`}>
              {[...raid.trainRaids].sort((a, b) => a.order - b.order).map(r => `${r.raidAlias} ${r.difficulty}`).join(" → ")}
            </p>
          )}
          <div className={`text-xs mb-2 ${d ? "text-gray-400" : "text-gray-500"}`}>
            {raid.isMobaChul ? "⚡ 모바출" : `📆 ${raid.date} ${raid.time}`}
          </div>
          <div className="flex gap-3 text-xs mt-auto">
            <span className={d ? "text-amber-400" : "text-purple-600"}>
              ⚔️ {dealers.length}/{dealerSlots}
            </span>
            <span className={d ? "text-blue-400" : "text-blue-600"}>
              🛡️ {supporters.length}/{supporterSlots}
            </span>
            <span className={d ? "text-gray-500" : "text-gray-400"}>
              👑 {raid.hostName}
            </span>
          </div>
        </Card>
      </a>
    )
  }

  const { mobaChul, dateGroups } = groupRaidsByDate(raids)

  return (
    <DashboardLayout themeId={themeId} setThemeId={setThemeId} session={session} activeNav="board">

      {/* 헤더 */}
      <div className="mb-8">
        <h1 className={`text-2xl font-bold ${d ? "text-white" : "text-gray-800"}`}
          style={{ fontFamily: "var(--font-cinzel), serif" }}>
          레이드 게시판
        </h1>
        <p className={`text-sm mt-1 ${d ? "text-gray-400" : "text-gray-500"}`}>
          이번 주 서버별 레이드 현황
        </p>
      </div>

      {/* 주간 네비게이터 */}
      <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border mb-6
        ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
        <button
          onClick={() => handleWeekChange(-1)}
          disabled={weekOffset === 0}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors
            ${weekOffset === 0
              ? d ? "text-gray-600 cursor-not-allowed" : "text-gray-300 cursor-not-allowed"
              : d ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-purple-50"
            }`}>
          <ChevronLeft size={14} />
          이전 주
        </button>
        <span className={`text-sm font-medium ${d ? "text-gray-200" : "text-gray-700"}`}>
          {formatWeekLabel(weekOffset)}
        </span>
        <button
          onClick={() => handleWeekChange(1)}
          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition-colors
            ${d ? "text-gray-300 hover:bg-white/10" : "text-gray-600 hover:bg-purple-50"}`}>
          다음 주
          <ChevronRight size={14} />
        </button>
      </div>

      {/* 서버 탭 */}
      {guildsLoading ? (
        <p className={`text-sm ${d ? "text-gray-500" : "text-gray-400"}`}>서버 목록 불러오는 중...</p>
      ) : guilds.length === 0 ? (
        <Card className={`border p-8 text-center ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
          <p className="text-2xl mb-2">🤖</p>
          <p className={`text-sm ${d ? "text-gray-500" : "text-gray-400"}`}>봇이 설치된 서버가 없습니다</p>
        </Card>
      ) : (
        <>
          {/* 탭 목록 */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide">
            {guilds.map(guild => {
              const isSelected = selectedGuildId === guild.id
              return (
                <button
                  key={guild.id}
                  onClick={() => handleGuildSelect(guild.id)}
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

          {/* 레이드 현황 */}
          {raidsLoading ? (
            <p className={`text-sm py-8 text-center ${d ? "text-gray-500" : "text-gray-400"}`}>불러오는 중...</p>
          ) : raids.length === 0 ? (
            <Card className={`border p-12 text-center ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
              <p className="text-3xl mb-3">📭</p>
              <p className={`text-sm ${d ? "text-gray-500" : "text-gray-400"}`}>이번 주 등록된 레이드가 없습니다</p>
            </Card>
          ) : (
            <div className="space-y-6">
              {mobaChul.length > 0 && (
                <div>
                  <p className={`text-xs font-semibold mb-3 ${d ? "text-amber-400" : "text-amber-600"}`}>⚡ 모바출</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
                    {mobaChul.map(raid => <RaidCard key={raid._id} raid={raid} />)}
                  </div>
                </div>
              )}
              {dateGroups.map(({ date, raids: dateRaids }) => (
                <div key={date}>
                  <p className={`text-xs font-semibold mb-3 ${d ? "text-gray-400" : "text-gray-500"}`}>
                    {formatDateLabel(date)}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
                    {dateRaids.map(raid => <RaidCard key={raid._id} raid={raid} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  )
}
