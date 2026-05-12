"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ChevronLeft, Calendar, Clock, Users, Zap, Hash, Crown, Sword, Shield, X } from "lucide-react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { getTheme } from "@/lib/themes"
import { SUPPORTER_CLASSES, getMinLevel } from "@/lib/lostarkData"

export default function RaidDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const [themeId, setThemeId] = useState("dark")
  const [mounted, setMounted] = useState(false)
  const [raid, setRaid] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [editDate, setEditDate] = useState("")
  const [editTime, setEditTime] = useState("")
  const [savingSchedule, setSavingSchedule] = useState(false)

  // N수 레이드 참가 모달
  const [nsuModal, setNsuModal] = useState(false)
  const [nsuSelections, setNsuSelections] = useState({})
  const [nsuJoining, setNsuJoining] = useState(false)
  const [nsuError, setNsuError] = useState(null)
  const [nsuChars, setNsuChars] = useState([])
  const [nsuCharsLoading, setNsuCharsLoading] = useState(false)

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
    if (status === "authenticated" && params.id) {
      fetch(`/api/raids/${params.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.raid) setRaid(data.raid)
          else setError(data.error)
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [status, params.id])

  if (!mounted || status === "loading") return null
  if (!session) return null

  const theme = getTheme(themeId)
  const d = theme.isDark

  const difficultyColor = {
    "노말": d ? "text-emerald-400" : "text-emerald-600",
    "하드": d ? "text-red-400" : "text-red-600",
    "싱글": d ? "text-blue-400" : "text-blue-600",
    "나이트메어": d ? "text-purple-400" : "text-purple-600",
    "The First": d ? "text-amber-400" : "text-amber-600",
  }

  const statusColor = {
    "모집중":   d ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-600 border-emerald-200",
    "모집완료": d ? "bg-blue-500/15 text-blue-400 border-blue-500/30"         : "bg-blue-50 text-blue-600 border-blue-200",
    "출발완료": d ? "bg-amber-500/15 text-amber-400 border-amber-500/30"      : "bg-amber-50 text-amber-600 border-amber-200",
    "완료":     d ? "bg-gray-500/15 text-gray-400 border-gray-500/30"         : "bg-gray-50 text-gray-500 border-gray-200",
    "취소":     d ? "bg-red-500/15 text-red-400 border-red-500/30"            : "bg-red-50 text-red-600 border-red-200",
  }

  const isHost = raid && session.user && (
    raid.hostId === session.user.discordId ||
    raid.hostId === session.user.id
  )

  const isParticipant = raid && session.user && raid.participants?.some(
    p => p.userId === session.user.discordId || p.userId === session.user.id
  )

  const isAlreadyJoinedNsu = !!(raid?.totalRounds >= 2 &&
    raid.rounds?.some(r =>
      r.participants?.some(p =>
        p.userId === (session?.user?.discordId || session?.user?.id)
      )
    )
  )

  const supporterSlots = raid ? raid.maxPlayers / 4 : 0
  const dealerSlots = raid ? raid.maxPlayers - supporterSlots : 0
  const dealers = raid?.participants?.filter(p => p.role === "dealer") || []
  const supporters = raid?.participants?.filter(p => p.role === "support") || []

  const todayStr = new Date(Date.now() + 9*60*60*1000).toISOString().slice(0, 10)
  const minTime = editDate === todayStr
    ? new Date(Date.now() + 9*60*60*1000).toISOString().slice(11, 16)
    : "00:00"

  // 참가자 참가 취소 (본인 참가 취소)
  const handleLeave = async () => {
    if (!confirm("참가를 취소하시겠습니까?")) return
    setLeaving(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/raids/${params.id}/leave`, {
        method: "POST",
      })
      const data = await res.json()
      if (data.success) {
        setRaid(data.raid)
      } else {
        setActionError(data.error)
      }
    } catch (e) {
      setActionError(e.message)
    } finally {
      setLeaving(false)
    }
  }

  const handleSaveSchedule = async () => {
    const todayKST = new Date(Date.now() + 9*60*60*1000)
    const todayStr = todayKST.toISOString().slice(0, 10)
    const nowTimeStr = todayKST.toISOString().slice(11, 16)
    if (editDate < todayStr || (editDate === todayStr && editTime <= nowTimeStr)) {
      setActionError("현재 시각 이후로만 설정할 수 있습니다.")
      return
    }
    setSavingSchedule(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/raids/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editDate, time: editTime }),
      })
      const data = await res.json()
      if (data.success) {
        setRaid(data.raid)
        setEditingSchedule(false)
      } else {
        setActionError(data.error)
      }
    } catch (e) {
      setActionError(e.message)
    } finally {
      setSavingSchedule(false)
    }
  }

  // 주최자 레이드 취소 (Discord 메시지 삭제)
  const handleCancelRaid = async () => {
    if (!confirm("정말 레이드를 취소하시겠습니까? Discord 메시지도 삭제됩니다.")) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/raids/${params.id}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (data.success) {
        router.push("/dashboard")
      } else {
        alert(data.error)
      }
    } catch (e) {
      alert(e.message)
    } finally {
      setCancelling(false)
    }
  }

  const openNsuModal = async () => {
    const initSelections = {}
    for (let i = 1; i <= raid.totalRounds; i++) initSelections[i] = { role: "dealer" }
    setNsuSelections(initSelections)
    setNsuError(null)
    setNsuModal(true)
    setNsuCharsLoading(true)
    try {
      const res = await fetch("/api/characters")
      const data = await res.json()
      const accounts = data.accounts || []
      const minLevel = getMinLevel(raid.raidAlias, raid.difficulty)
      const merged = []
      accounts.forEach(acc => {
        acc.characters.forEach(c => {
          if (!minLevel || c.level >= minLevel) merged.push({ ...c, accountIndex: acc.accountIndex })
        })
      })
      merged.sort((a, b) => b.level - a.level)
      setNsuChars(merged)
    } catch {
      setNsuError("캐릭터를 불러오지 못했습니다.")
    } finally {
      setNsuCharsLoading(false)
    }
  }

  const handleNsuCharSelect = (order, value) => {
    if (!value) return
    const [charName, charClass, charLevelStr, combatPowerStr] = value.split("||")
    const isSupporter = SUPPORTER_CLASSES.includes(charClass)
    setNsuSelections(prev => ({
      ...prev,
      [order]: {
        ...prev[order],
        characterName: charName,
        characterClass: charClass,
        characterLevel: parseFloat(charLevelStr),
        characterCombatPower: combatPowerStr ? parseInt(combatPowerStr) : null,
        role: isSupporter ? "support" : "dealer",
      },
    }))
  }

  const handleNsuRoleToggle = (order, role) => {
    setNsuSelections(prev => ({ ...prev, [order]: { ...prev[order], role } }))
  }

  const handleNsuSubmit = async () => {
    for (let i = 1; i <= raid.totalRounds; i++) {
      if (!nsuSelections[i]?.characterName) {
        setNsuError(`${i}수 캐릭터를 선택해주세요`)
        return
      }
    }
    setNsuJoining(true)
    setNsuError(null)
    try {
      const roundSelections = Array.from({ length: raid.totalRounds }, (_, i) => ({
        order: i + 1,
        ...nsuSelections[i + 1],
      }))
      const res = await fetch(`/api/raids/${params.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundSelections }),
      })
      const data = await res.json()
      if (data.success) {
        setNsuModal(false)
        setRaid(data.raid)
      } else {
        setNsuError(data.error)
      }
    } catch {
      setNsuError("서버 오류가 발생했습니다.")
    } finally {
      setNsuJoining(false)
    }
  }

  return (
    <DashboardLayout themeId={themeId} setThemeId={setThemeId} session={session} activeNav="">
      <div className="max-w-3xl">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <a href="/dashboard"
            className={`p-2 rounded-xl transition-colors ${d ? "hover:bg-white/10" : "hover:bg-purple-100"}`}>
            <ChevronLeft size={18} />
          </a>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-cinzel), serif" }}>
              레이드 상세
            </h1>
            <p className={`text-sm mt-0.5 ${d ? "text-gray-400" : "text-gray-500"}`}>
              레이드 예약 정보 및 참가자 현황
            </p>
          </div>
        </div>

        {loading && (
          <div className={`text-center py-20 text-sm animate-pulse ${d ? "text-gray-500" : "text-gray-400"}`}>
            불러오는 중...
          </div>
        )}

        {error && (
          <Card className={`border p-8 text-center ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
            <p className="text-red-400 text-sm">{error}</p>
            <a href="/dashboard">
              <Button className="mt-4" size="sm">대시보드로 돌아가기</Button>
            </a>
          </Card>
        )}

        {raid && (
          <div className="space-y-5">

            {/* 레이드 정보 카드 */}
            <Card className={`border p-6 ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-xs ${d ? "bg-white/5 text-gray-400 border-white/10" : "bg-purple-50 text-purple-400 border-purple-100"}`}>
                      {raid.isTrain ? "🚂 기차 레이드" : raid.raidTag}
                    </Badge>
                    <Badge className={`text-xs border ${statusColor[raid.status] || statusColor["모집중"]}`}>
                      {raid.status}
                    </Badge>
                  </div>
                  <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                    {raid.isTrain ? raid.trainLabel : raid.raidAlias}
                  </h2>
                  {!raid.isTrain && (
                    <p className={`text-sm mt-0.5 ${d ? "text-gray-400" : "text-gray-500"}`}>
                      {raid.raidName}
                    </p>
                  )}
                </div>
                {!raid.isTrain && (
                  <span className={`text-2xl font-bold ${difficultyColor[raid.difficulty] || ""}`}>
                    {raid.difficulty}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl ${d ? "bg-white/5" : "bg-purple-50"}`}>
                  <p className={`text-xs font-medium mb-2 ${d ? "text-gray-400" : "text-gray-500"}`}>일정</p>
                  {raid.isMobaChul ? (
                    <div className="flex items-center gap-2">
                      <Zap size={14} className={d ? "text-amber-400" : "text-purple-500"} />
                      <span className="text-sm font-medium">모바출</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar size={14} className={d ? "text-gray-400" : "text-gray-500"} />
                        <span className="text-sm">{raid.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className={d ? "text-gray-400" : "text-gray-500"} />
                        <span className="text-sm">{raid.time}</span>
                      </div>
                    </>
                  )}
                </div>

                <div className={`p-4 rounded-xl ${d ? "bg-white/5" : "bg-purple-50"}`}>
                  <p className={`text-xs font-medium mb-2 ${d ? "text-gray-400" : "text-gray-500"}`}>인원 현황</p>
                  <div className="flex items-center gap-2 mb-1">
                    <Sword size={14} className={d ? "text-red-400" : "text-red-500"} />
                    <span className="text-sm">딜러 {dealers.length} / {dealerSlots}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield size={14} className={d ? "text-blue-400" : "text-blue-500"} />
                    <span className="text-sm">서포터 {supporters.length} / {supporterSlots}</span>
                  </div>
                </div>
              </div>

              {/* 기차 레이드 구성 */}
              {raid.isTrain && raid.trainRaids?.length > 0 && (
                <div className={`mt-4 p-4 rounded-xl ${d ? "bg-white/5" : "bg-purple-50"}`}>
                  <p className={`text-xs font-medium mb-2 ${d ? "text-gray-400" : "text-gray-500"}`}>레이드 구성</p>
                  <div className="space-y-1">
                    {[...raid.trainRaids].sort((a, b) => a.order - b.order).map((r, i) => (
                      <p key={i} className="text-sm">
                        {i + 1}. ({r.raidTag}) {r.raidAlias} {r.difficulty}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {raid.discordChannelId && (
                <div className={`mt-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs
                  ${d ? "bg-white/5 text-gray-400" : "bg-purple-50 text-gray-500"}`}>
                  <Hash size={12} />
                  <span>Discord 채널에 공지됨</span>
                  {raid.discordMessageId && (
                    <span className={`ml-auto ${d ? "text-gray-600" : "text-gray-400"}`}>
                      ID: {raid.discordMessageId.slice(-8)}
                    </span>
                  )}
                </div>
              )}
            </Card>

            {/* 참가자 목록 */}
            <Card className={`border p-6 ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Users size={16} />
                참가자 목록 ({raid.participants?.length || 0} / {raid.maxPlayers})
              </h3>

              {/* 딜러 */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sword size={13} className={d ? "text-red-400" : "text-red-500"} />
                  <span className={`text-xs font-medium ${d ? "text-gray-400" : "text-gray-500"}`}>
                    딜러 ({dealers.length}/{dealerSlots})
                  </span>
                </div>
                <div className="space-y-2">
                  {dealers.map((p, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl
                      ${d ? "bg-white/5" : "bg-gray-50"}`}>
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarImage src={p.userImage} />
                        <AvatarFallback className="text-xs">{p.userName?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.userName}</p>
                        {p.characterName && (
                          <p className={`text-xs truncate ${d ? "text-gray-400" : "text-gray-500"}`}>
                            ({p.characterClass}) {p.characterName} Lv.{p.characterLevel}
                            {p.characterCombatPower
                              ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}`
                              : ""
                            }
                          </p>
                        )}
                      </div>
                      {raid.hostId === p.userId && (
                        <Crown size={12} className={d ? "text-amber-400" : "text-amber-500"} />
                      )}
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, dealerSlots - dealers.length) }).map((_, i) => (
                    <div key={`empty-d-${i}`} className={`flex items-center gap-3 px-3 py-2 rounded-xl border border-dashed
                      ${d ? "border-white/10" : "border-gray-200"}`}>
                      <div className={`w-7 h-7 rounded-full ${d ? "bg-white/5" : "bg-gray-100"}`} />
                      <span className={`text-sm ${d ? "text-gray-600" : "text-gray-300"}`}>빈 자리</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 서포터 */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={13} className={d ? "text-blue-400" : "text-blue-500"} />
                  <span className={`text-xs font-medium ${d ? "text-gray-400" : "text-gray-500"}`}>
                    서포터 ({supporters.length}/{supporterSlots})
                  </span>
                </div>
                <div className="space-y-2">
                  {supporters.map((p, i) => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl
                      ${d ? "bg-white/5" : "bg-gray-50"}`}>
                      <Avatar className="w-7 h-7 shrink-0">
                        <AvatarImage src={p.userImage} />
                        <AvatarFallback className="text-xs">{p.userName?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.userName}</p>
                        {p.characterName && (
                          <p className={`text-xs truncate ${d ? "text-gray-400" : "text-gray-500"}`}>
                            ({p.characterClass}) {p.characterName} Lv.{p.characterLevel}
                            {p.characterCombatPower
                              ? ` | 전투력 ${p.characterCombatPower.toLocaleString()}`
                              : ""
                            }
                          </p>
                        )}
                      </div>
                      {raid.hostId === p.userId && (
                        <Crown size={12} className={d ? "text-amber-400" : "text-amber-500"} />
                      )}
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, supporterSlots - supporters.length) }).map((_, i) => (
                    <div key={`empty-s-${i}`} className={`flex items-center gap-3 px-3 py-2 rounded-xl border border-dashed
                      ${d ? "border-white/10" : "border-gray-200"}`}>
                      <div className={`w-7 h-7 rounded-full ${d ? "bg-white/5" : "bg-gray-100"}`} />
                      <span className={`text-sm ${d ? "text-gray-600" : "text-gray-300"}`}>빈 자리</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* 액션 버튼 */}
            <Card className={`border p-5 ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
              {editingSchedule ? (
                <>
                  {actionError && <p className="text-red-400 text-xs text-center mb-3">{actionError}</p>}
                  <p className={`text-sm font-medium mb-3 ${d ? "text-white" : "text-gray-800"}`}>일정 수정</p>
                  <div className="space-y-3">
                    <div>
                      <label className={`block text-xs mb-1 ${d ? "text-gray-400" : "text-gray-500"}`}>날짜</label>
                      <input type="date" value={editDate} min={todayStr}
                        onChange={e => setEditDate(e.target.value)}
                        className={`w-full text-sm px-3 py-2 rounded-xl border
                          ${d ? "bg-white/5 border-white/10 text-white" : "bg-white border-purple-200 text-gray-700"}`}
                      />
                    </div>
                    <div>
                      <label className={`block text-xs mb-1 ${d ? "text-gray-400" : "text-gray-500"}`}>시간</label>
                      <input type="time" value={editTime} min={minTime}
                        onChange={e => setEditTime(e.target.value)}
                        className={`w-full text-sm px-3 py-2 rounded-xl border
                          ${d ? "bg-white/5 border-white/10 text-white" : "bg-white border-purple-200 text-gray-700"}`}
                      />
                    </div>
                    <div className="flex gap-3 pt-1">
                      <Button disabled={savingSchedule}
                        onClick={handleSaveSchedule}
                        className={`flex-1 py-3 font-bold
                          ${d ? "bg-purple-500/80 hover:bg-purple-500 text-white" : "bg-purple-600 hover:bg-purple-500 text-white"}`}>
                        {savingSchedule ? "저장 중..." : "저장"}
                      </Button>
                      <Button variant="outline"
                        onClick={() => { setEditingSchedule(false); setActionError(null) }}
                        className={`flex-1 py-3 ${d ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-500"}`}>
                        취소
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {actionError && (
                    <p className="text-red-400 text-xs text-center mb-3">{actionError}</p>
                  )}

                  {raid.status === "취소" ? (
                    <p className={`text-center text-sm ${d ? "text-gray-500" : "text-gray-400"}`}>
                      취소된 레이드입니다
                    </p>
                  ) : isHost ? (
                    // 주최자 버튼
                    <>
                      <div className="flex gap-3">
                        {["모집중", "모집완료"].includes(raid.status) && (
                          <Button
                            disabled={raid.isMobaChul}
                            title={raid.isMobaChul ? "모바출 레이드는 일정 수정이 불가합니다" : ""}
                            className={`flex-1 py-3 font-bold transition-all
                              ${raid.isMobaChul
                                ? "opacity-40 cursor-not-allowed bg-gray-500 text-white"
                                : d
                                  ? "bg-purple-500/80 hover:bg-purple-500 text-white"
                                  : "bg-purple-600 hover:bg-purple-500 text-white"
                              }`}
                            onClick={() => {
                              if (!raid.isMobaChul) {
                                setEditDate(raid.date)
                                setEditTime(raid.time)
                                setEditingSchedule(true)
                              }
                            }}>
                            📅 일정 수정
                          </Button>
                        )}
                        {raid.isMobaChul && (
                          <Button
                            className={`flex-1 py-3 font-bold
                              ${d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"}`}
                            onClick={() => alert("레이드 출발 기능 준비 중! 추후 업데이트 예정입니다.")}>
                            ⚔️ 레이드 출발
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          disabled={cancelling}
                          className={`${(["모집중", "모집완료"].includes(raid.status) || raid.isMobaChul) ? "px-4" : "flex-1"} py-3 ${d ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-red-200 text-red-500 hover:bg-red-50"}`}
                          onClick={handleCancelRaid}>
                          {cancelling ? "⏳" : <X size={16} />}
                        </Button>
                      </div>
                      {["모집중", "모집완료"].includes(raid.status) && raid.isMobaChul && (
                        <p className={`text-xs text-center mt-2 ${d ? "text-gray-500" : "text-gray-400"}`}>
                          모바출 레이드는 일정 수정이 불가합니다
                        </p>
                      )}
                    </>
                  ) : isParticipant ? (
                    // 참가자 버튼 (본인 참가 취소)
                    <Button
                      variant="outline"
                      disabled={leaving}
                      className={`w-full py-3 ${d ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-red-200 text-red-500 hover:bg-red-50"}`}
                      onClick={handleLeave}>
                      {leaving ? "⏳" : "❌"} 참가 취소
                    </Button>
                  ) : raid.totalRounds >= 2 ? (
                    isAlreadyJoinedNsu ? (
                      <Button
                        disabled
                        className="w-full py-3 font-bold opacity-60 cursor-not-allowed bg-gray-500 text-white">
                        ✅ 참가 완료
                      </Button>
                    ) : (
                      <Button
                        className={`w-full py-3 font-bold
                          ${d ? "bg-purple-500/80 hover:bg-purple-500 text-white" : "bg-purple-600 hover:bg-purple-500 text-white"}`}
                        onClick={openNsuModal}>
                        ⚔️ 레이드 참가
                      </Button>
                    )
                  ) : (
                    // 미참가자 안내
                    <p className={`text-center text-sm ${d ? "text-gray-500" : "text-gray-400"}`}>
                      Discord 채널에서 참가 버튼을 눌러 참가하세요.
                    </p>
                  )}
                </>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* N수 레이드 참가 모달 */}
      {nsuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setNsuModal(false)} />
          <div className={`relative w-full max-w-md rounded-2xl border p-6 z-10
            ${d ? "bg-gray-900 border-white/10" : "bg-white border-purple-200"}`}>
            <h3 className={`text-lg font-bold mb-5 ${d ? "text-white" : "text-gray-800"}`}>
              ⚔️ {raid?.totalRounds}수 레이드 참가
            </h3>

            {nsuCharsLoading ? (
              <p className={`text-sm text-center py-8 animate-pulse ${d ? "text-gray-500" : "text-gray-400"}`}>
                캐릭터 불러오는 중...
              </p>
            ) : (
              <div className="space-y-5 max-h-96 overflow-y-auto pr-1">
                {Array.from({ length: raid?.totalRounds || 0 }, (_, i) => {
                  const order = i + 1
                  const sel = nsuSelections[order] || {}
                  const charValue = sel.characterName
                    ? `${sel.characterName}||${sel.characterClass}||${sel.characterLevel}||${sel.characterCombatPower ?? ""}`
                    : ""
                  return (
                    <div key={order}>
                      <p className={`text-sm font-bold mb-2 ${d ? "text-white" : "text-gray-800"}`}>
                        {order}수
                      </p>
                      <select
                        value={charValue}
                        onChange={e => handleNsuCharSelect(order, e.target.value)}
                        className={`w-full text-sm px-3 py-2 rounded-xl border mb-2
                          ${d ? "bg-white/5 border-white/10 text-white" : "bg-white border-purple-200 text-gray-700"}`}>
                        <option value="">캐릭터를 선택하세요</option>
                        {(() => {
                          const otherSelected = new Set(
                            Object.entries(nsuSelections)
                              .filter(([k]) => parseInt(k) !== order)
                              .map(([, v]) => v.characterName)
                              .filter(Boolean)
                          )
                          return nsuChars
                            .filter(c => !otherSelected.has(c.name))
                            .map((c, idx) => (
                              <option key={idx} value={`${c.name}||${c.class}||${c.level}||${c.combatPower ?? ""}`}>
                                [계정{c.accountIndex}] {c.name} · {c.class} · Lv.{c.level}
                              </option>
                            ))
                        })()}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleNsuRoleToggle(order, "dealer")}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
                            ${sel.role === "dealer"
                              ? d ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-red-50 text-red-600 border border-red-200"
                              : d ? "bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent" : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-transparent"
                            }`}>
                          ⚔️ 딜러
                        </button>
                        <button
                          onClick={() => handleNsuRoleToggle(order, "support")}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors
                            ${sel.role === "support"
                              ? d ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-blue-50 text-blue-600 border border-blue-200"
                              : d ? "bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent" : "bg-gray-50 text-gray-500 hover:bg-gray-100 border border-transparent"
                            }`}>
                          🛡️ 서포터
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {nsuError && (
              <p className="text-red-400 text-xs text-center mt-3">{nsuError}</p>
            )}

            <div className="flex gap-3 mt-5">
              <Button
                disabled={nsuJoining || nsuCharsLoading}
                onClick={handleNsuSubmit}
                className={`flex-1 py-3 font-bold
                  ${nsuJoining || nsuCharsLoading
                    ? "opacity-40 cursor-not-allowed bg-gray-500 text-white"
                    : d ? "bg-purple-500/80 hover:bg-purple-500 text-white" : "bg-purple-600 hover:bg-purple-500 text-white"
                  }`}>
                {nsuJoining ? "신청 중..." : "참가 신청"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setNsuModal(false)}
                className={`flex-1 py-3 ${d ? "border-white/10 text-gray-400" : "border-gray-200 text-gray-500"}`}>
                취소
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
