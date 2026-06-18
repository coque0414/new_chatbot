"use client"

import { useEffect, useState } from "react"

export default function AdminStatsPage() {
  const [mounted, setMounted] = useState(false)
  const [secret, setSecret] = useState("")
  const [secretInput, setSecretInput] = useState("")
  const [authError, setAuthError] = useState("")
  const [stats, setStats] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [days, setDays] = useState(30)

  useEffect(() => {
    setMounted(true)
    const saved = sessionStorage.getItem("admin_secret")
    if (saved) {
      setSecret(saved)
      loadStats(saved, 30)
    }
  }, [])

  const loadStats = async (s, d) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/stats?secret=${encodeURIComponent(s)}&days=${d}`)
      const data = await res.json()
      if (res.status === 401) {
        setAuthError("비밀번호가 틀렸습니다.")
        setSecret("")
        sessionStorage.removeItem("admin_secret")
        return
      }
      setStats(data.stats || [])
      setSummary(data.summary || null)
    } catch {
      setAuthError("서버 오류가 발생했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleAuth = async (e) => {
    e.preventDefault()
    setAuthError("")
    const res = await fetch(`/api/stats?secret=${encodeURIComponent(secretInput)}&days=${days}`)
    if (res.status === 401) {
      setAuthError("비밀번호가 틀렸습니다.")
      return
    }
    const data = await res.json()
    sessionStorage.setItem("admin_secret", secretInput)
    setSecret(secretInput)
    setStats(data.stats || [])
    setSummary(data.summary || null)
  }

  const handleDaysChange = (d) => {
    setDays(d)
    if (secret) loadStats(secret, d)
  }

  if (!mounted) return null

  if (!secret) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <form onSubmit={handleAuth} className="bg-gray-900 rounded-xl p-8 w-full max-w-sm flex flex-col gap-4">
          <h1 className="text-white text-xl font-bold text-center">관리자 인증</h1>
          <input
            type="password"
            value={secretInput}
            onChange={e => setSecretInput(e.target.value)}
            placeholder="비밀번호"
            className="bg-gray-800 text-white rounded-lg px-4 py-2 outline-none border border-gray-700 focus:border-blue-500"
          />
          {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg py-2 transition-colors">
            확인
          </button>
        </form>
      </div>
    )
  }

  const commandKeys = ["모집", "모바출모집", "참가", "같이참가", "지난레이드삭제"]
  const commandTotals = commandKeys.reduce((acc, key) => {
    acc[key] = stats.reduce((s, d) => s + (d.commandUsage?.[key] || 0), 0)
    return acc
  }, {})
  const maxCommandVal = Math.max(...Object.values(commandTotals), 1)

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">봇 사용 통계</h1>
          <div className="flex gap-2">
            {[7, 14, 30, 60].map(d => (
              <button
                key={d}
                onClick={() => handleDaysChange(d)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${days === d ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
              >
                {d}일
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="text-gray-400 text-center py-12">로딩 중...</p>}

        {!loading && summary && (
          <>
            {/* 합산 카드 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[
                { label: "총 커맨드 사용", value: summary.totalCommands },
                { label: "총 버튼 클릭", value: summary.totalButtonClicks },
                { label: "총 레이드 생성", value: summary.totalRaidsCreated },
                { label: "총 참가 처리", value: summary.totalRaidsJoined },
              ].map(item => (
                <div key={item.label} className="bg-gray-900 rounded-xl p-4">
                  <p className="text-gray-400 text-sm mb-1">{item.label}</p>
                  <p className="text-3xl font-bold text-white">{item.value.toLocaleString()}</p>
                </div>
              ))}
            </div>

            {/* 커맨드별 바 차트 */}
            <div className="bg-gray-900 rounded-xl p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4">커맨드별 사용 횟수</h2>
              <div className="flex flex-col gap-3">
                {commandKeys.map(key => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-gray-300 text-sm w-28 shrink-0">/{key}</span>
                    <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${(commandTotals[key] / maxCommandVal) * 100}%` }}
                      />
                    </div>
                    <span className="text-gray-300 text-sm w-8 text-right">{commandTotals[key]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 날짜별 테이블 */}
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <h2 className="text-lg font-semibold p-6 pb-3">날짜별 상세</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-400">
                      <th className="px-4 py-3 text-left">날짜</th>
                      <th className="px-4 py-3 text-right">모집</th>
                      <th className="px-4 py-3 text-right">참가</th>
                      <th className="px-4 py-3 text-right">같이참가</th>
                      <th className="px-4 py-3 text-right">딜러참가</th>
                      <th className="px-4 py-3 text-right">서포터참가</th>
                      <th className="px-4 py-3 text-right">레이드생성</th>
                      <th className="px-4 py-3 text-right">레이드참가</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map(row => (
                      <tr key={row.date} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3 text-gray-300 font-mono">{row.date}</td>
                        <td className="px-4 py-3 text-right">{(row.commandUsage?.["모집"] || 0) + (row.commandUsage?.["모바출모집"] || 0)}</td>
                        <td className="px-4 py-3 text-right">{row.commandUsage?.["참가"] || 0}</td>
                        <td className="px-4 py-3 text-right">{row.commandUsage?.["같이참가"] || 0}</td>
                        <td className="px-4 py-3 text-right">{row.buttonClicks?.join_dealer || 0}</td>
                        <td className="px-4 py-3 text-right">{row.buttonClicks?.join_support || 0}</td>
                        <td className="px-4 py-3 text-right">{(row.raidsCreated?.web || 0) + (row.raidsCreated?.discord || 0)}</td>
                        <td className="px-4 py-3 text-right">{(row.raidsJoined?.web || 0) + (row.raidsJoined?.discord || 0)}</td>
                      </tr>
                    ))}
                    {stats.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-gray-500">데이터 없음</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
