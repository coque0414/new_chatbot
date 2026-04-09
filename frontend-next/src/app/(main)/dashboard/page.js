"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChevronDown } from "lucide-react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { getTheme } from "@/lib/themes"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [themeId, setThemeId] = useState("dark")
  const [mounted, setMounted] = useState(false)
  const [myRaids, setMyRaids] = useState([])
  const [joinedRaids, setJoinedRaids] = useState([])
  const [raidsLoading, setRaidsLoading] = useState(true)
  const [myShowAll, setMyShowAll] = useState(false)
  const [joinedShowAll, setJoinedShowAll] = useState(false)
  const [guilds, setGuilds] = useState([])
  const [guildsLoading, setGuildsLoading] = useState(true)
  const [expandedGuild, setExpandedGuild] = useState(null)
  const [guildRaids, setGuildRaids] = useState({})
  const [guildRaidsLoading, setGuildRaidsLoading] = useState({})

  useEffect(() => {
    if (status !== "authenticated") return
    const fetchRaids = async () => {
      try {
        const [myRes, joinedRes] = await Promise.all([
          fetch("/api/raids?type=my"),
          fetch("/api/raids?type=joined"),
        ])
        const myData     = await myRes.json()
        const joinedData = await joinedRes.json()

        const sortByDate = (a, b) => new Date(b.createdAt) - new Date(a.createdAt)

        setMyRaids((myData.raids || []).sort(sortByDate))
        setJoinedRaids((joinedData.raids || []).sort(sortByDate))
      } catch (e) {
        console.error("레이드 목록 불러오기 실패:", e)
      } finally {
        setRaidsLoading(false)
      }
    }
    fetchRaids()
  }, [status])

  useEffect(() => {
    if (status !== "authenticated") return
    fetch("/api/discord/guilds")
      .then(r => r.json())
      .then(data => setGuilds(data.guilds || []))
      .catch(e => console.error("서버 목록 불러오기 실패:", e))
      .finally(() => setGuildsLoading(false))
  }, [status])

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
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

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
  const user = session.user

  const isExpired = (raid) => {
    if (raid.isMobaChul) return false
    if (!raid.date || !raid.time) return false
    return new Date() > new Date(`${raid.date}T${raid.time}:00+09:00`)
  }

  const handleGuildClick = async (guildId) => {
    if (expandedGuild === guildId) { setExpandedGuild(null); return }
    setExpandedGuild(guildId)
    if (guildRaids[guildId] !== undefined) return
    setGuildRaidsLoading(prev => ({ ...prev, [guildId]: true }))
    try {
      const res = await fetch(`/api/raids?guildId=${guildId}&status=active`)
      const data = await res.json()
      setGuildRaids(prev => ({ ...prev, [guildId]: data.raids || [] }))
    } catch (e) {
      console.error("서버 레이드 불러오기 실패:", e)
    } finally {
      setGuildRaidsLoading(prev => ({ ...prev, [guildId]: false }))
    }
  }

  const sortRaids = (raids) => {
    const now = new Date()
    return [...raids].sort((a, b) => {
      if (a.isMobaChul && !b.isMobaChul) return -1
      if (!a.isMobaChul && b.isMobaChul) return 1
      if (a.isMobaChul && b.isMobaChul) return new Date(b.createdAt) - new Date(a.createdAt)
      const aTime = new Date(`${a.date}T${a.time}:00+09:00`)
      const bTime = new Date(`${b.date}T${b.time}:00+09:00`)
      return Math.abs(aTime - now) - Math.abs(bTime - now)
    })
  }

  const statusColor = {
    "모집중":   d ? "text-green-400 bg-green-400/10"  : "text-green-600 bg-green-50",
    "모집완료": d ? "text-blue-400 bg-blue-400/10"   : "text-blue-600 bg-blue-50",
    "출발완료": d ? "text-amber-400 bg-amber-400/10" : "text-amber-600 bg-amber-50",
    "취소":     d ? "text-gray-500 bg-gray-500/10"   : "text-gray-400 bg-gray-100",
  }

  const RaidCard = ({ raid, isMyRaid, onNotifyChange }) => {
    const [savingNotify, setSavingNotify] = useState(false)
    const expired = isExpired(raid)
    const isDimmed = raid.status === "취소" || raid.status === "출발완료" || expired
    const supporterSlots = raid.maxPlayers / 4
    const dealerSlots = raid.maxPlayers - supporterSlots
    const dealers = raid.participants?.filter(p => p.role === "dealer") || []
    const supporters = raid.participants?.filter(p => p.role === "support") || []
    const currentNotify = raid.notifyMinutesBefore ?? 30

    const isTrain = !!(raid.isTrain || raid.trainLabel)
    const href = `/raids/${raid._id}`

    const handleNotifyChange = async (e, minutes) => {
      e.preventDefault()
      e.stopPropagation()
      if (isDimmed || savingNotify || currentNotify === minutes) return
      setSavingNotify(true)
      try {
        const res = await fetch(`/api/raids/${raid._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notifyMinutesBefore: minutes }),
        })
        const data = await res.json()
        if (data.success && onNotifyChange) onNotifyChange(raid._id, minutes)
      } catch (e) {
        console.error("알림 설정 변경 실패:", e)
      } finally {
        setSavingNotify(false)
      }
    }

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

          {isMyRaid && !raid.isMobaChul && raid.status !== "취소" && (
            <div className={`mt-3 pt-3 border-t border-dashed ${d ? "border-white/10" : "border-purple-100"}`}>
              <p className={`text-xs mb-1.5 ${d ? "text-gray-500" : "text-gray-400"}`}>
                ⏰ DM 알림 {savingNotify && <span className="animate-pulse">저장 중...</span>}
              </p>
              <div className="flex gap-1.5" onClick={e => e.preventDefault()}>
                {[10, 20, 30].map(min => (
                  <button
                    key={min}
                    onClick={(e) => handleNotifyChange(e, min)}
                    disabled={isDimmed || savingNotify}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors
                      ${isDimmed ? "cursor-not-allowed" : ""}
                      ${currentNotify === min
                        ? d ? "bg-amber-500/30 text-amber-400 border border-amber-500/50" : "bg-purple-600 text-white border border-purple-600"
                        : d ? "bg-white/5 text-gray-400 border border-white/10 hover:border-white/20" : "bg-purple-50 text-gray-500 border border-purple-100 hover:border-purple-300"
                      }`}>
                    {min}분 전
                  </button>
                ))}
              </div>
            </div>
          )}
        </Card>
      </a>
    )
  }

  return (
    <DashboardLayout themeId={themeId} setThemeId={setThemeId} session={session} activeNav="dashboard">

      {/* 헤더 */}
      <div className="mb-8">
        <h1 className={`text-2xl font-bold ${d ? "text-white" : "text-gray-800"}`}
          style={{ fontFamily: "var(--font-cinzel), serif" }}>
          대시보드
        </h1>
        <p className={`text-sm mt-1 ${d ? "text-gray-400" : "text-gray-500"}`}>
          안녕하세요, {user.name}님! 오늘도 좋은 레이드 되세요. ⚔️
        </p>
      </div>

      {/* 빠른 실행 버튼 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { icon: "➕", label: "레이드 예약 생성", href: "/raid-create", primary: true },
          { icon: "💬", label: "공략 챗봇", href: "/chat" },
          { icon: "⚙️", label: "봇 설정", href: "/bot-settings" },
        ].map((btn) => (
          <a key={btn.label} href={btn.href}>
            <Card className={`p-5 border cursor-pointer transition-all duration-200 hover:scale-[1.02]
              ${btn.primary
                ? d ? "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20" : "bg-purple-600 border-purple-600 hover:bg-purple-500"
                : d ? "bg-white/[0.03] border-white/10 hover:border-white/20" : "bg-white border-purple-100 hover:border-purple-300 hover:shadow-sm"
              }`}>
              <div className="text-2xl mb-2">{btn.icon}</div>
              <p className={`text-sm font-medium
                ${btn.primary
                  ? d ? "text-amber-400" : "text-white"
                  : d ? "text-white" : "text-gray-700"
                }`}>
                {btn.label}
              </p>
            </Card>
          </a>
        ))}
      </div>

      {/* 내 레이드 예약 */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h2 className={`text-base font-bold mb-4 ${d ? "text-white" : "text-gray-800"}`}>
            내가 만든 레이드
          </h2>
          {raidsLoading ? (
            <p className={`text-sm ${d ? "text-gray-500" : "text-gray-400"}`}>불러오는 중...</p>
          ) : myRaids.length === 0 ? (
            <Card className={`border p-8 text-center ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
              <p className="text-3xl mb-3">📅</p>
              <p className={`text-sm ${d ? "text-gray-500" : "text-gray-400"}`}>아직 만든 레이드가 없어요</p>
              <a href="/raid-create">
                <Button size="sm" className={`mt-4 text-xs ${d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"}`}>
                  레이드 만들기
                </Button>
              </a>
            </Card>
          ) : (
            <>
              <div className="space-y-3">{myRaids.slice(0, myShowAll ? myRaids.length : 3).map(raid => (
                <RaidCard
                  key={raid._id}
                  raid={raid}
                  isMyRaid={true}
                  onNotifyChange={(id, minutes) =>
                    setMyRaids(prev => prev.map(r => r._id === id ? { ...r, notifyMinutesBefore: minutes } : r))
                  }
                />
              ))}</div>
              {myRaids.length > 3 && (
                <button
                  onClick={() => setMyShowAll(!myShowAll)}
                  className={`w-full text-xs py-2 rounded-xl border mt-1 transition-colors
                    ${d ? "border-white/10 text-gray-400 hover:bg-white/5" : "border-purple-100 text-gray-500 hover:bg-purple-50"}`}>
                  {myShowAll ? "접기" : `더 보기 (총 ${myRaids.length}개)`}
                </button>
              )}
            </>
          )}
        </div>

        <div>
          <h2 className={`text-base font-bold mb-4 ${d ? "text-white" : "text-gray-800"}`}>
            참가한 레이드
          </h2>
          {raidsLoading ? (
            <p className={`text-sm ${d ? "text-gray-500" : "text-gray-400"}`}>불러오는 중...</p>
          ) : joinedRaids.length === 0 ? (
            <Card className={`border p-8 text-center ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
              <p className="text-3xl mb-3">🎮</p>
              <p className={`text-sm ${d ? "text-gray-500" : "text-gray-400"}`}>참가한 레이드가 없어요</p>
            </Card>
          ) : (
            <>
              <div className="space-y-3">{joinedRaids.slice(0, joinedShowAll ? joinedRaids.length : 3).map(raid => (
                <RaidCard key={raid._id} raid={raid} />
              ))}</div>
              {joinedRaids.length > 3 && (
                <button
                  onClick={() => setJoinedShowAll(!joinedShowAll)}
                  className={`w-full text-xs py-2 rounded-xl border mt-1 transition-colors
                    ${d ? "border-white/10 text-gray-400 hover:bg-white/5" : "border-purple-100 text-gray-500 hover:bg-purple-50"}`}>
                  {joinedShowAll ? "접기" : `더 보기 (총 ${joinedRaids.length}개)`}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 서버별 레이드 현황 */}
      <div className="mt-8">
        <h2 className={`text-base font-bold mb-4 ${d ? "text-white" : "text-gray-800"}`}>
          서버별 레이드 현황
        </h2>
        {guildsLoading ? (
          <p className={`text-sm ${d ? "text-gray-500" : "text-gray-400"}`}>불러오는 중...</p>
        ) : guilds.length === 0 ? (
          <Card className={`border p-8 text-center ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
            <p className="text-2xl mb-2">🤖</p>
            <p className={`text-sm ${d ? "text-gray-500" : "text-gray-400"}`}>봇이 설치된 서버가 없습니다</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {guilds.map(guild => (
              <div key={guild.id}>
                <button
                  onClick={() => handleGuildClick(guild.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors
                    ${expandedGuild === guild.id
                      ? d ? "bg-amber-500/10 border-amber-500/30" : "bg-purple-50 border-purple-300"
                      : d ? "bg-white/[0.03] border-white/10 hover:border-white/20" : "bg-white border-purple-100 hover:border-purple-200"
                    }`}>
                  <div className="flex items-center gap-3">
                    {guild.icon ? (
                      <img src={guild.icon} alt={guild.name} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                        ${d ? "bg-white/10 text-gray-400" : "bg-purple-100 text-purple-600"}`}>
                        {guild.name[0]}
                      </div>
                    )}
                    <span className={`text-sm font-medium ${d ? "text-white" : "text-gray-800"}`}>{guild.name}</span>
                  </div>
                  <ChevronDown size={16} className={`transition-transform duration-200
                    ${expandedGuild === guild.id ? "rotate-180" : ""}
                    ${d ? "text-gray-500" : "text-gray-400"}`} />
                </button>

                {expandedGuild === guild.id && (
                  <div className={`mt-1 px-1 pb-1`}>
                    {guildRaidsLoading[guild.id] ? (
                      <p className={`text-sm py-4 text-center ${d ? "text-gray-500" : "text-gray-400"}`}>불러오는 중...</p>
                    ) : !guildRaids[guild.id] || guildRaids[guild.id].length === 0 ? (
                      <p className={`text-sm py-4 text-center ${d ? "text-gray-500" : "text-gray-400"}`}>
                        진행 중인 레이드가 없습니다
                      </p>
                    ) : (
                      <div className="pt-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
                        {sortRaids(guildRaids[guild.id]).map(raid => <RaidCard key={raid._id} raid={raid} />)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
