"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { ChevronLeft } from "lucide-react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { getTheme } from "@/lib/themes"

export default function TrainDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const [themeId, setThemeId] = useState("dark")
  const [mounted, setMounted] = useState(false)
  const [train, setTrain] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
    if (status === "authenticated" && params.trainId) {
      fetch(`/api/raids/train/${params.trainId}`)
        .then(res => res.json())
        .then(data => {
          if (data.train) setTrain(data.train)
          else setError(data.error)
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    }
  }, [status, params.trainId])

  if (!mounted || status === "loading") return null
  if (!session) return null

  const theme = getTheme(themeId)
  const d = theme.isDark

  const isExpired = (t) => {
    if (t.isMobaChul) return false
    if (!t.date || !t.time) return false
    return new Date() > new Date(`${t.date}T${t.time}:00+09:00`)
  }

  const statusColor = {
    "모집중":   d ? "text-green-400 bg-green-400/10"  : "text-green-600 bg-green-50",
    "모집완료": d ? "text-blue-400 bg-blue-400/10"   : "text-blue-600 bg-blue-50",
    "출발완료": d ? "text-amber-400 bg-amber-400/10" : "text-amber-600 bg-amber-50",
    "취소":     d ? "text-gray-500 bg-gray-500/10"   : "text-gray-400 bg-gray-100",
  }

  return (
    <DashboardLayout themeId={themeId} setThemeId={setThemeId} session={session} activeNav="dashboard">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.back()}
          className={`flex items-center gap-1 text-sm mb-6 transition-colors
            ${d ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-800"}`}>
          <ChevronLeft size={16} />
          뒤로 가기
        </button>

        {loading ? (
          <p className={`text-sm ${d ? "text-gray-500" : "text-gray-400"}`}>불러오는 중...</p>
        ) : error ? (
          <p className={`text-sm ${d ? "text-red-400" : "text-red-500"}`}>{error}</p>
        ) : !train ? null : (() => {
          const expired = isExpired(train)
          const supporterSlots = train.maxPlayers / 4
          const dealerSlots = train.maxPlayers - supporterSlots
          const dealers = train.participants?.filter(p => p.role === "dealer") || []
          const supporters = train.participants?.filter(p => p.role === "support") || []

          return (
            <>
              {/* 헤더 */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className={`text-xl font-bold ${d ? "text-white" : "text-gray-800"}`}>
                    {train.trainLabel}
                  </h1>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[train.status]}`}>
                    {train.status}
                  </span>
                  {expired && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d ? "text-gray-500 bg-gray-500/10" : "text-gray-400 bg-gray-100"}`}>
                      종료
                    </span>
                  )}
                </div>
                <p className={`text-sm ${d ? "text-gray-400" : "text-gray-500"}`}>
                  {train.isMobaChul ? "⚡ 모바출" : `📆 ${train.date} ${train.time}`}
                  {" · "}👑 {train.hostName}
                </p>
              </div>

              {/* 레이드 구성 */}
              <Card className={`p-4 border mb-4 ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
                <p className={`text-xs font-semibold mb-3 ${d ? "text-gray-400" : "text-gray-500"}`}>📋 레이드 구성</p>
                <div className="space-y-2">
                  {train.raids?.map(r => (
                    <div key={r.trainOrder} className={`flex items-center gap-2 text-sm ${d ? "text-white" : "text-gray-800"}`}>
                      <span className={`text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold
                        ${d ? "bg-amber-500/20 text-amber-400" : "bg-purple-100 text-purple-600"}`}>
                        {r.trainOrder}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${d ? "bg-white/10 text-gray-300" : "bg-gray-100 text-gray-600"}`}>
                        {r.raidTag}
                      </span>
                      <span className="font-medium">{r.raidAlias}</span>
                      <span className={`text-xs ${d ? "text-gray-400" : "text-gray-500"}`}>{r.difficulty}</span>
                    </div>
                  ))}
                </div>
              </Card>

              {/* 모집 정보 */}
              <Card className={`p-4 border mb-4 ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
                <p className={`text-xs font-semibold mb-3 ${d ? "text-gray-400" : "text-gray-500"}`}>👥 모집 현황</p>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className={`text-xs ${d ? "text-gray-500" : "text-gray-400"}`}>⚔️ 딜러</span>
                    <p className={`font-bold mt-0.5 ${d ? "text-amber-400" : "text-purple-600"}`}>
                      {dealers.length} / {dealerSlots}
                    </p>
                  </div>
                  <div>
                    <span className={`text-xs ${d ? "text-gray-500" : "text-gray-400"}`}>🛡️ 서포터</span>
                    <p className={`font-bold mt-0.5 ${d ? "text-blue-400" : "text-blue-600"}`}>
                      {supporters.length} / {supporterSlots}
                    </p>
                  </div>
                  <div>
                    <span className={`text-xs ${d ? "text-gray-500" : "text-gray-400"}`}>👥 전체</span>
                    <p className={`font-bold mt-0.5 ${d ? "text-white" : "text-gray-800"}`}>
                      {train.participants?.length ?? 0} / {train.maxPlayers}
                    </p>
                  </div>
                </div>
              </Card>

              {/* 참가자 목록 */}
              {(dealers.length > 0 || supporters.length > 0) && (
                <Card className={`p-4 border ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
                  <p className={`text-xs font-semibold mb-3 ${d ? "text-gray-400" : "text-gray-500"}`}>📋 참가자 명단</p>
                  {dealers.length > 0 && (
                    <div className="mb-3">
                      <p className={`text-xs mb-2 ${d ? "text-amber-400" : "text-purple-600"}`}>⚔️ 딜러</p>
                      <div className="space-y-1">
                        {dealers.map((p, i) => (
                          <div key={p.userId} className={`flex items-center gap-2 text-sm ${d ? "text-gray-300" : "text-gray-700"}`}>
                            <span className={`text-xs ${d ? "text-gray-500" : "text-gray-400"}`}>{i + 1}.</span>
                            <span>{p.userName}</span>
                            {p.characterName && (
                              <span className={`text-xs ${d ? "text-gray-500" : "text-gray-400"}`}>
                                ({p.characterClass}) {p.characterName} Lv.{p.characterLevel}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {supporters.length > 0 && (
                    <div>
                      <p className={`text-xs mb-2 ${d ? "text-blue-400" : "text-blue-600"}`}>🛡️ 서포터</p>
                      <div className="space-y-1">
                        {supporters.map((p, i) => (
                          <div key={p.userId} className={`flex items-center gap-2 text-sm ${d ? "text-gray-300" : "text-gray-700"}`}>
                            <span className={`text-xs ${d ? "text-gray-500" : "text-gray-400"}`}>{i + 1}.</span>
                            <span>{p.userName}</span>
                            {p.characterName && (
                              <span className={`text-xs ${d ? "text-gray-500" : "text-gray-400"}`}>
                                ({p.characterClass}) {p.characterName} Lv.{p.characterLevel}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}
            </>
          )
        })()}
      </div>
    </DashboardLayout>
  )
}
