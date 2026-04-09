"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, User, Crown, Search, RefreshCw } from "lucide-react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { getTheme } from "@/lib/themes"

export default function CharactersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [themeId, setThemeId] = useState("dark")
  const [mounted, setMounted] = useState(false)

  const [characterName, setCharacterName] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const [characters, setCharacters] = useState([])
  const [representCharacter, setRepresentCharacter] = useState(null)
  const [loading, setLoading] = useState(true)

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
    if (status === "authenticated") {
      fetch("/api/characters")
        .then(r => r.json())
        .then(data => {
          setCharacters(data.characters || [])
          setRepresentCharacter(data.representCharacter || null)
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [status])

  if (!mounted || status === "loading") return null
  if (!session) return null

  const theme = getTheme(themeId)
  const d = theme.isDark

  const inputClass = `w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors
    ${d
      ? "bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50"
      : "bg-white border-purple-100 text-gray-800 placeholder-gray-400 focus:border-purple-300"
    }`

  const handleVerify = async () => {
    if (!characterName.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    setSubmitSuccess(false)
    try {
      const res = await fetch("/api/characters/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterName: characterName.trim() }),
      })
      const data = await res.json()
      if (data.ok) {
        setCharacters(data.characters || [])
        setRepresentCharacter(characterName.trim())
        setSubmitSuccess(true)
        setCharacterName("")
      } else {
        setSubmitError(data.error || "연동에 실패했습니다.")
      }
    } catch (e) {
      setSubmitError("서버 오류가 발생했습니다.")
    } finally {
      setSubmitting(false)
    }
  }

  const roleClass = (cls) => {
    // 서포터 직업 목록 (간단 판별)
    const supporters = ["바드", "홀리나이트", "도화가"]
    return supporters.includes(cls) ? "support" : "dealer"
  }

  return (
    <DashboardLayout themeId={themeId} setThemeId={setThemeId} session={session} activeNav="characters">
      <div className="max-w-2xl">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <a href="/dashboard"
            className={`p-2 rounded-xl transition-colors ${d ? "hover:bg-white/10" : "hover:bg-purple-100"}`}>
            <ChevronLeft size={18} />
          </a>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-cinzel), serif" }}>
              캐릭터 연동
            </h1>
            <p className={`text-sm mt-0.5 ${d ? "text-gray-400" : "text-gray-500"}`}>
              로스트아크 대표 캐릭터를 연동하면 레이드 참가 시 정보가 표시됩니다
            </p>
          </div>
        </div>

        {/* 연동 폼 */}
        <Card className={`border p-6 mb-5 ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
          <h2 className={`text-base font-bold mb-1 ${d ? "text-white" : "text-gray-800"}`}>
            {representCharacter ? "캐릭터 재연동" : "캐릭터 연동"}
          </h2>
          <p className={`text-xs mb-4 ${d ? "text-gray-500" : "text-gray-400"}`}>
            원정대 내 아무 캐릭터명이나 입력하면 원정대 전체가 조회됩니다
          </p>

          {representCharacter && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-sm
              ${d ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" : "bg-purple-50 border border-purple-200 text-purple-700"}`}>
              <Crown size={14} />
              <span>현재 대표 캐릭터: <strong>{representCharacter}</strong></span>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={characterName}
              onChange={e => setCharacterName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleVerify()}
              placeholder="캐릭터명 입력 (예: 홍길동)"
              className={inputClass}
            />
            <Button
              disabled={submitting || !characterName.trim()}
              className={`px-5 shrink-0 font-bold
                ${submitting || !characterName.trim()
                  ? "opacity-40 cursor-not-allowed bg-gray-500 text-white"
                  : d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"
                }`}
              onClick={handleVerify}>
              {submitting
                ? <RefreshCw size={16} className="animate-spin" />
                : <Search size={16} />
              }
            </Button>
          </div>

          {submitError && (
            <p className="text-red-400 text-xs mt-2">{submitError}</p>
          )}
          {submitSuccess && (
            <p className={`text-xs mt-2 ${d ? "text-emerald-400" : "text-emerald-600"}`}>
              ✅ 캐릭터 연동이 완료되었습니다! ({characters.length}개 캐릭터 등록)
            </p>
          )}
        </Card>

        {/* 캐릭터 목록 */}
        <Card className={`border p-6 ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
          <h2 className={`text-base font-bold mb-4 flex items-center gap-2 ${d ? "text-white" : "text-gray-800"}`}>
            <User size={16} />
            내 원정대 캐릭터
            {characters.length > 0 && (
              <span className={`text-sm font-normal ${d ? "text-gray-500" : "text-gray-400"}`}>
                ({characters.length}개)
              </span>
            )}
          </h2>

          {loading ? (
            <p className={`text-sm text-center py-8 animate-pulse ${d ? "text-gray-500" : "text-gray-400"}`}>
              불러오는 중...
            </p>
          ) : characters.length === 0 ? (
            <div className={`text-center py-10 ${d ? "text-gray-500" : "text-gray-400"}`}>
              <User size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">연동된 캐릭터가 없습니다.</p>
              <p className="text-xs mt-1">위 폼에서 캐릭터명을 입력해 연동하세요.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...characters]
                .sort((a, b) => b.level - a.level)
                .map((c, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl
                    ${c.name === representCharacter
                      ? d ? "bg-amber-500/10 border border-amber-500/20" : "bg-purple-50 border border-purple-200"
                      : d ? "bg-white/5" : "bg-gray-50"
                    }`}>

                    {/* 직업 뱃지 */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                      ${roleClass(c.class) === "support"
                        ? d ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                        : d ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600"
                      }`}>
                      {roleClass(c.class) === "support" ? "🛡" : "⚔️"}
                    </div>

                    {/* 캐릭터 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold truncate ${d ? "text-white" : "text-gray-800"}`}>
                          {c.name}
                        </span>
                        {c.name === representCharacter && (
                          <Crown size={12} className={d ? "text-amber-400" : "text-amber-500"} />
                        )}
                      </div>
                      <p className={`text-xs truncate ${d ? "text-gray-400" : "text-gray-500"}`}>
                        {c.class} · {c.server} · Lv.{c.level}
                        {c.combatPower != null && (
                          <span className={d ? " text-amber-400/80" : " text-purple-500"}>
                            {" "}· 전투력 {c.combatPower.toLocaleString()}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* 레벨 배지 */}
                    <Badge className={`text-xs shrink-0
                      ${d ? "bg-white/5 text-gray-400 border-white/10" : "bg-purple-50 text-purple-500 border-purple-100"}`}>
                      {c.level}
                    </Badge>
                  </div>
                ))}
            </div>
          )}
        </Card>

      </div>
    </DashboardLayout>
  )
}
