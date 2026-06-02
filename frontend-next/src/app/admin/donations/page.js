"use client"

import { useEffect, useState } from "react"

export default function AdminDonationsPage() {
  const [mounted, setMounted] = useState(false)
  const [secret, setSecret] = useState("")
  const [secretInput, setSecretInput] = useState("")
  const [authError, setAuthError] = useState("")
  const [donations, setDonations] = useState([])
  const [loading, setLoading] = useState(false)
  const [confirmingId, setConfirmingId] = useState(null)
  const [confirmResults, setConfirmResults] = useState({}) // id → "ok" | "error"

  useEffect(() => {
    setMounted(true)
    const saved = sessionStorage.getItem("admin_secret")
    if (saved) {
      setSecret(saved)
      loadDonations(saved)
    }
  }, [])

  const loadDonations = async (s) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/donation?secret=${encodeURIComponent(s)}`)
      const data = await res.json()
      if (res.status === 401) {
        setAuthError("비밀번호가 틀렸습니다.")
        setSecret("")
        sessionStorage.removeItem("admin_secret")
        return
      }
      setDonations(data.donations || [])
    } catch {
      setAuthError("서버 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthError("")
    const res = await fetch(`/api/donation?secret=${encodeURIComponent(secretInput)}`)
    if (res.status === 401) {
      setAuthError("비밀번호가 틀렸습니다.")
      return
    }
    const data = await res.json()
    sessionStorage.setItem("admin_secret", secretInput)
    setSecret(secretInput)
    setDonations(data.donations || [])
  }

  const handleConfirm = async (id) => {
    setConfirmingId(id)
    try {
      const res = await fetch("/api/donation/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, donationId: id }),
      })
      const data = await res.json()
      if (data.ok) {
        setConfirmResults(prev => ({ ...prev, [id]: "ok" }))
        setDonations(prev => prev.map(d =>
          d._id === id ? { ...d, status: "confirmed", confirmedAt: new Date().toISOString() } : d
        ))
      } else {
        setConfirmResults(prev => ({ ...prev, [id]: "error" }))
      }
    } catch {
      setConfirmResults(prev => ({ ...prev, [id]: "error" }))
    } finally {
      setConfirmingId(null)
    }
  }

  if (!mounted) return null

  const totalAmount = donations.reduce((s, d) => s + d.amount, 0)
  const confirmedAmount = donations.filter(d => d.status === "confirmed").reduce((s, d) => s + d.amount, 0)

  if (!secret) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-white/10 p-6">
          <h1 className="text-xl font-bold text-white mb-1">관리자 로그인</h1>
          <p className="text-sm text-gray-400 mb-6">후원 확인 페이지</p>
          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="password"
              value={secretInput}
              onChange={e => setSecretInput(e.target.value)}
              placeholder="비밀번호 입력"
              className="w-full px-4 py-3 rounded-xl border bg-white/5 border-white/10 text-white placeholder-gray-500 outline-none focus:border-amber-500/50 text-sm"
            />
            {authError && <p className="text-xs text-red-400">{authError}</p>}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors">
              확인
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">☕ 후원 관리</h1>
            <p className="text-sm text-gray-400 mt-0.5">후원 신청 목록 및 확인 처리</p>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem("admin_secret"); setSecret(""); setSecretInput("") }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            로그아웃
          </button>
        </div>

        {/* 합계 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "전체 신청", value: `${donations.length}건`, sub: `${totalAmount.toLocaleString()}원` },
            { label: "확인 완료", value: `${donations.filter(d => d.status === "confirmed").length}건`, sub: `${confirmedAmount.toLocaleString()}원` },
            { label: "대기 중", value: `${donations.filter(d => d.status === "pending").length}건`, sub: "" },
          ].map(item => (
            <div key={item.label} className="bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400">{item.label}</p>
              <p className="text-xl font-bold text-white mt-0.5">{item.value}</p>
              {item.sub && <p className="text-xs text-amber-400">{item.sub}</p>}
            </div>
          ))}
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-12">불러오는 중...</p>
        ) : donations.length === 0 ? (
          <p className="text-center text-gray-500 py-12">후원 내역이 없습니다.</p>
        ) : (
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-gray-400">
                  <th className="px-4 py-3 text-left">날짜</th>
                  <th className="px-4 py-3 text-left">Discord</th>
                  <th className="px-4 py-3 text-left">입금자명</th>
                  <th className="px-4 py-3 text-right">금액</th>
                  <th className="px-4 py-3 text-left">메시지</th>
                  <th className="px-4 py-3 text-center">상태</th>
                  <th className="px-4 py-3 text-center">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {donations.map(d => (
                  <tr key={d._id} className={d.status === "confirmed" ? "bg-emerald-500/5" : ""}>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(d.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-gray-200 max-w-[120px] truncate">{d.discordName}</td>
                    <td className="px-4 py-3 text-gray-200">{d.senderName}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-400 whitespace-nowrap">
                      ₩{d.amount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate">{d.message || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        d.status === "confirmed"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}>
                        {d.status === "confirmed" ? "완료" : "대기"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {d.status === "pending" ? (
                        <button
                          onClick={() => handleConfirm(d._id)}
                          disabled={confirmingId === d._id}
                          className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
                          {confirmingId === d._id ? "처리 중..." : "확인 완료"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-600">
                          {confirmResults[d._id] === "ok" ? "✅ DM 발송" : "완료"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
