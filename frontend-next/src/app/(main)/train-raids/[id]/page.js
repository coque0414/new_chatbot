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

export default function TrainRaidDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const [themeId, setThemeId] = useState("dark")
  const [mounted, setMounted] = useState(false)
  const [trainRaid, setTrainRaid] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [editDate, setEditDate] = useState("")
  const [editTime, setEditTime] = useState("")
  const [savingSchedule, setSavingSchedule] = useState(false)

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
          if (data.raid) setTrainRaid(data.raid)
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

  const statusColor = {
    "모집중":   d ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-600 border-emerald-200",
    "모집완료": d ? "bg-blue-500/15 text-blue-400 border-blue-500/30"         : "bg-blue-50 text-blue-600 border-blue-200",
    "출발완료": d ? "bg-amber-500/15 text-amber-400 border-amber-500/30"      : "bg-amber-50 text-amber-600 border-amber-200",
    "취소":     d ? "bg-red-500/15 text-red-400 border-red-500/30"            : "bg-red-50 text-red-600 border-red-200",
  }

  const isHost = trainRaid && session.user && (
    trainRaid.hostId === session.user.discordId ||
    trainRaid.hostId === session.user.id
  )

  const supporterSlots = trainRaid ? trainRaid.maxPlayers / 4 : 0
  const dealerSlots    = trainRaid ? trainRaid.maxPlayers - supporterSlots : 0
  const dealers    = trainRaid?.participants?.filter(p => p.role === "dealer") || []
  const supporters = trainRaid?.participants?.filter(p => p.role === "support") || []

  const todayStr = new Date(Date.now() + 9*60*60*1000).toISOString().slice(0, 10)
  const minTime = editDate === todayStr
    ? new Date(Date.now() + 9*60*60*1000).toISOString().slice(11, 16)
    : "00:00"

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
        setTrainRaid(data.raid)
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

  const handleCancelRaid = async () => {
    if (!confirm("정말 N종 레이드를 취소하시겠습니까?")) return
    setCancelling(true)
    try {
      const res = await fetch(`/api/raids/${params.id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        router.push("/dashboard")
      } else {
        setActionError(data.error)
      }
    } catch (e) {
      setActionError(e.message)
    } finally {
      setCancelling(false)
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
              N종 레이드 상세
            </h1>
            <p className={`text-sm mt-0.5 ${d ? "text-gray-400" : "text-gray-500"}`}>
              N종 레이드 예약 정보 및 참가자 현황
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

        {trainRaid && (
          <div className="space-y-5">

            {/* 기차 정보 카드 */}
            <Card className={`border p-6 ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`text-xs ${d ? "bg-purple-500/15 text-purple-400 border-purple-500/30" : "bg-purple-50 text-purple-500 border-purple-200"}`}>
                      N종 레이드
                    </Badge>
                    <Badge className={`text-xs border ${statusColor[trainRaid.status] || statusColor["모집중"]}`}>
                      {trainRaid.status}
                    </Badge>
                  </div>
                  <h2 className="text-xl font-bold break-words" style={{ fontFamily: "var(--font-cinzel), serif" }}>
                    {trainRaid.trainLabel}
                  </h2>
                </div>
              </div>

              {/* 레이드 구성 */}
              {trainRaid.trainRaids?.length > 0 && (
                <div className={`mb-4 p-4 rounded-xl ${d ? "bg-white/5" : "bg-purple-50"}`}>
                  <p className={`text-xs font-medium mb-2 ${d ? "text-gray-400" : "text-gray-500"}`}>레이드 구성</p>
                  <div className="space-y-1">
                    {[...trainRaid.trainRaids].sort((a, b) => a.order - b.order).map((r, i) => (
                      <p key={i} className={`text-sm ${d ? "text-gray-300" : "text-gray-700"}`}>
                        {i + 1}. ({r.raidTag}) {r.raidAlias} {r.difficulty}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl ${d ? "bg-white/5" : "bg-purple-50"}`}>
                  <p className={`text-xs font-medium mb-2 ${d ? "text-gray-400" : "text-gray-500"}`}>일정</p>
                  {trainRaid.isMobaChul ? (
                    <div className="flex items-center gap-2">
                      <Zap size={14} className={d ? "text-amber-400" : "text-purple-500"} />
                      <span className="text-sm font-medium">모바출</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar size={14} className={d ? "text-gray-400" : "text-gray-500"} />
                        <span className="text-sm">{trainRaid.date}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className={d ? "text-gray-400" : "text-gray-500"} />
                        <span className="text-sm">{trainRaid.time}</span>
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

              {trainRaid.discordChannelId && (
                <div className={`mt-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs
                  ${d ? "bg-white/5 text-gray-400" : "bg-purple-50 text-gray-500"}`}>
                  <Hash size={12} />
                  <span>Discord 채널에 공지됨</span>
                  {trainRaid.discordMessageId && (
                    <span className={`ml-auto ${d ? "text-gray-600" : "text-gray-400"}`}>
                      ID: {trainRaid.discordMessageId.slice(-8)}
                    </span>
                  )}
                </div>
              )}
            </Card>

            {/* 참가자 목록 */}
            <Card className={`border p-6 ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
              <h3 className="font-bold text-base mb-4 flex items-center gap-2">
                <Users size={16} />
                참가자 목록 ({trainRaid.participants?.length || 0} / {trainRaid.maxPlayers})
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
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${d ? "bg-white/5" : "bg-gray-50"}`}>
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={p.userImage} />
                        <AvatarFallback className="text-xs">{p.userName?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{p.userName}</span>
                        {p.characterName && (
                          <span className={`text-xs ml-2 ${d ? "text-gray-500" : "text-gray-400"}`}>
                            ({p.characterClass}) {p.characterName} Lv.{p.characterLevel}
                          </span>
                        )}
                      </div>
                      {trainRaid.hostId === p.userId && (
                        <Crown size={12} className={d ? "text-amber-400" : "text-amber-500"} />
                      )}
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, dealerSlots - dealers.length) }).map((_, i) => (
                    <div key={`empty-d-${i}`} className={`flex items-center gap-3 px-3 py-2 rounded-xl border border-dashed ${d ? "border-white/10" : "border-gray-200"}`}>
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
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded-xl ${d ? "bg-white/5" : "bg-gray-50"}`}>
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={p.userImage} />
                        <AvatarFallback className="text-xs">{p.userName?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm">{p.userName}</span>
                        {p.characterName && (
                          <span className={`text-xs ml-2 ${d ? "text-gray-500" : "text-gray-400"}`}>
                            ({p.characterClass}) {p.characterName} Lv.{p.characterLevel}
                          </span>
                        )}
                      </div>
                      {trainRaid.hostId === p.userId && (
                        <Crown size={12} className={d ? "text-amber-400" : "text-amber-500"} />
                      )}
                    </div>
                  ))}
                  {Array.from({ length: Math.max(0, supporterSlots - supporters.length) }).map((_, i) => (
                    <div key={`empty-s-${i}`} className={`flex items-center gap-3 px-3 py-2 rounded-xl border border-dashed ${d ? "border-white/10" : "border-gray-200"}`}>
                      <div className={`w-7 h-7 rounded-full ${d ? "bg-white/5" : "bg-gray-100"}`} />
                      <span className={`text-sm ${d ? "text-gray-600" : "text-gray-300"}`}>빈 자리</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* 액션 카드 (주최자만) */}
            {isHost && trainRaid.status !== "취소" && trainRaid.status !== "출발완료" && (
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
                    {actionError && <p className="text-red-400 text-xs text-center mb-3">{actionError}</p>}
                    <div className="flex gap-3">
                      {["모집중", "모집완료"].includes(trainRaid.status) && (
                        <Button
                          disabled={trainRaid.isMobaChul}
                          title={trainRaid.isMobaChul ? "모바출 레이드는 일정 수정이 불가합니다" : ""}
                          className={`flex-1 py-3 font-bold transition-all
                            ${trainRaid.isMobaChul
                              ? "opacity-40 cursor-not-allowed bg-gray-500 text-white"
                              : d
                                ? "bg-purple-500/80 hover:bg-purple-500 text-white"
                                : "bg-purple-600 hover:bg-purple-500 text-white"
                            }`}
                          onClick={() => {
                            if (!trainRaid.isMobaChul) {
                              setEditDate(trainRaid.date)
                              setEditTime(trainRaid.time)
                              setEditingSchedule(true)
                            }
                          }}>
                          📅 일정 수정
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        disabled={cancelling}
                        className={`px-4 py-3 ${d ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-red-200 text-red-500 hover:bg-red-50"}`}
                        onClick={handleCancelRaid}>
                        {cancelling ? "⏳" : <X size={16} />}
                      </Button>
                      {!["모집중", "모집완료"].includes(trainRaid.status) && (
                        <p className={`flex-1 text-xs self-center ${d ? "text-gray-500" : "text-gray-400"}`}>
                          N종 레이드 참가/취소는 Discord 버튼을 통해 진행하세요.
                        </p>
                      )}
                    </div>
                    {["모집중", "모집완료"].includes(trainRaid.status) && trainRaid.isMobaChul && (
                      <p className={`text-xs text-center mt-2 ${d ? "text-gray-500" : "text-gray-400"}`}>
                        모바출 레이드는 일정 수정이 불가합니다
                      </p>
                    )}
                  </>
                )}
              </Card>
            )}

            {trainRaid.status === "취소" && (
              <Card className={`border p-5 text-center ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
                <p className={`text-sm ${d ? "text-gray-500" : "text-gray-400"}`}>취소된 N종 레이드입니다</p>
              </Card>
            )}

          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
