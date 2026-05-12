"use client"

import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, User, Crown, Search, RefreshCw, Trash2 } from "lucide-react"
import DashboardLayout from "@/components/layout/DashboardLayout"
import { getTheme } from "@/lib/themes"

export default function CharactersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [themeId, setThemeId] = useState("dark")
  const [mounted, setMounted] = useState(false)

  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  const [inputs, setInputs] = useState({ 1: "", 2: "", 3: "", 4: "" })
  const [submittingIdx, setSubmittingIdx] = useState(null)
  const [deletingIdx, setDeletingIdx] = useState(null)
  const [errors, setErrors] = useState({})
  const [successes, setSuccesses] = useState({})
  const [selectedAccount, setSelectedAccount] = useState(1)

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
          setAccounts(data.accounts || [])
        })
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [status])

  if (!mounted || status === "loading") return null
  if (!session) return null

  const theme = getTheme(themeId)
  const d = theme.isDark

  const inputClass = `flex-1 px-4 py-2.5 rounded-xl border text-sm outline-none transition-colors
    ${d
      ? "bg-white/5 border-white/10 text-white placeholder-gray-500 focus:border-amber-500/50"
      : "bg-white border-purple-100 text-gray-800 placeholder-gray-400 focus:border-purple-300"
    }`

  const roleClass = (cls) => {
    const supporters = ["바드", "홀리나이트", "도화가", "발키리"]
    return supporters.includes(cls) ? "support" : "dealer"
  }

  const refreshAccounts = async () => {
    const r = await fetch("/api/characters")
    const data = await r.json()
    setAccounts(data.accounts || [])
  }

  const handleVerify = async (accountIndex) => {
    const charName = inputs[accountIndex]?.trim()
    if (!charName) return
    setSubmittingIdx(accountIndex)
    setErrors(prev => ({ ...prev, [accountIndex]: null }))
    setSuccesses(prev => ({ ...prev, [accountIndex]: false }))
    try {
      const res = await fetch("/api/characters/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterName: charName, accountIndex }),
      })
      const data = await res.json()
      if (data.ok) {
        await refreshAccounts()
        setInputs(prev => ({ ...prev, [accountIndex]: "" }))
        setSuccesses(prev => ({ ...prev, [accountIndex]: true }))
        setSelectedAccount(accountIndex)
      } else {
        setErrors(prev => ({ ...prev, [accountIndex]: data.error || "연동에 실패했습니다." }))
      }
    } catch {
      setErrors(prev => ({ ...prev, [accountIndex]: "서버 오류가 발생했습니다." }))
    } finally {
      setSubmittingIdx(null)
    }
  }

  const handleDelete = async (accountIndex) => {
    setDeletingIdx(accountIndex)
    setErrors(prev => ({ ...prev, [accountIndex]: null }))
    try {
      const res = await fetch(`/api/characters?accountIndex=${accountIndex}`, { method: "DELETE" })
      const data = await res.json()
      if (data.ok) {
        await refreshAccounts()
        if (selectedAccount === accountIndex) setSelectedAccount(1)
      } else {
        setErrors(prev => ({ ...prev, [accountIndex]: data.error || "삭제에 실패했습니다." }))
      }
    } catch {
      setErrors(prev => ({ ...prev, [accountIndex]: "서버 오류가 발생했습니다." }))
    } finally {
      setDeletingIdx(null)
    }
  }

  const connectedAccounts = [1, 2, 3, 4].map(idx => accounts.find(a => a.accountIndex === idx) || null)
  const selectedChars = accounts.find(a => a.accountIndex === selectedAccount)?.characters || []
  const selectedRepresentChar = accounts.find(a => a.accountIndex === selectedAccount)?.representCharacter || null

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
              최대 4개 원정대(계정)를 연동할 수 있습니다
            </p>
          </div>
        </div>

        {/* 연동 폼 */}
        <Card className={`border p-6 mb-5 ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
          <h2 className={`text-base font-bold mb-4 ${d ? "text-white" : "text-gray-800"}`}>
            원정대 연동
          </h2>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(idx => {
              const account = connectedAccounts[idx - 1]
              const isConnected = !!account
              const isSubmitting = submittingIdx === idx
              const isDeleting = deletingIdx === idx
              const inputVal = inputs[idx] || ""
              const error = errors[idx]
              const success = successes[idx]

              return (
                <div key={idx}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`text-xs font-medium ${d ? "text-gray-400" : "text-gray-500"}`}>
                      계정 {idx}{idx === 1 ? " (필수)" : " (선택)"}
                    </span>
                    {isConnected && (
                      <span className={`text-xs ${d ? "text-amber-400/80" : "text-purple-500"}`}>
                        · {account.representCharacter} · {account.characters.length}개 캐릭터
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputVal}
                      onChange={e => setInputs(prev => ({ ...prev, [idx]: e.target.value }))}
                      onKeyDown={e => e.key === "Enter" && handleVerify(idx)}
                      placeholder={isConnected ? "다른 캐릭터명으로 재연동" : "캐릭터명 입력 (예: 홍길동)"}
                      disabled={isSubmitting || isDeleting}
                      className={inputClass}
                    />
                    <Button
                      disabled={isSubmitting || !inputVal.trim() || isDeleting}
                      className={`px-4 shrink-0 font-bold
                        ${isSubmitting || !inputVal.trim() || isDeleting
                          ? "opacity-40 cursor-not-allowed bg-gray-500 text-white"
                          : d ? "bg-amber-500 hover:bg-amber-400 text-black" : "bg-purple-600 hover:bg-purple-500 text-white"
                        }`}
                      onClick={() => handleVerify(idx)}>
                      {isSubmitting
                        ? <RefreshCw size={15} className="animate-spin" />
                        : <Search size={15} />
                      }
                    </Button>
                    {idx > 1 && isConnected && (
                      <Button
                        disabled={isDeleting || isSubmitting}
                        variant="outline"
                        className={`px-3 shrink-0
                          ${isDeleting || isSubmitting
                            ? "opacity-40 cursor-not-allowed"
                            : d ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-red-200 text-red-500 hover:bg-red-50"
                          }`}
                        onClick={() => handleDelete(idx)}>
                        {isDeleting
                          ? <RefreshCw size={14} className="animate-spin" />
                          : <Trash2 size={14} />
                        }
                      </Button>
                    )}
                  </div>
                  {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
                  {success && (
                    <p className={`text-xs mt-1 ${d ? "text-emerald-400" : "text-emerald-600"}`}>
                      ✅ 연동 완료! ({account?.characters.length ?? 0}개 캐릭터 등록)
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </Card>

        {/* 캐릭터 목록 */}
        <Card className={`border p-6 ${d ? "bg-white/[0.03] border-white/10" : "bg-white border-purple-100"}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-base font-bold flex items-center gap-2 ${d ? "text-white" : "text-gray-800"}`}>
              <User size={16} />
              원정대 캐릭터
              {selectedChars.length > 0 && (
                <span className={`text-sm font-normal ${d ? "text-gray-500" : "text-gray-400"}`}>
                  ({selectedChars.length}개)
                </span>
              )}
            </h2>
            {accounts.length > 1 && (
              <div className="flex gap-1.5">
                {accounts.map(a => (
                  <button
                    key={a.accountIndex}
                    onClick={() => setSelectedAccount(a.accountIndex)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors
                      ${selectedAccount === a.accountIndex
                        ? d ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-purple-100 text-purple-700 border border-purple-200"
                        : d ? "bg-white/5 text-gray-400 hover:bg-white/10"
                            : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                      }`}>
                    계정 {a.accountIndex}
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <p className={`text-sm text-center py-8 animate-pulse ${d ? "text-gray-500" : "text-gray-400"}`}>
              불러오는 중...
            </p>
          ) : selectedChars.length === 0 ? (
            <div className={`text-center py-10 ${d ? "text-gray-500" : "text-gray-400"}`}>
              <User size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">연동된 캐릭터가 없습니다.</p>
              <p className="text-xs mt-1">위 폼에서 캐릭터명을 입력해 연동하세요.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...selectedChars]
                .sort((a, b) => b.level - a.level)
                .map((c, i) => (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl
                    ${c.name === selectedRepresentChar
                      ? d ? "bg-amber-500/10 border border-amber-500/20" : "bg-purple-50 border border-purple-200"
                      : d ? "bg-white/5" : "bg-gray-50"
                    }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold
                      ${roleClass(c.class) === "support"
                        ? d ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                        : d ? "bg-red-500/20 text-red-400" : "bg-red-100 text-red-600"
                      }`}>
                      {roleClass(c.class) === "support" ? "🛡" : "⚔️"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold truncate ${d ? "text-white" : "text-gray-800"}`}>
                          {c.name}
                        </span>
                        {c.name === selectedRepresentChar && (
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
