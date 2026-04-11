// 로스트아크 주간 초기화 기준 유틸리티
// 한 주 = 수요일 00:00 KST ~ 다음 주 화요일 23:59 KST

export function getLoaWeekStart(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  const day = kst.getUTCDay() // 0=일, 3=수
  const diffToWed = (day >= 3) ? day - 3 : day + 4
  const wed = new Date(kst)
  wed.setUTCDate(kst.getUTCDate() - diffToWed)
  wed.setUTCHours(0, 0, 0, 0)
  return wed // UTC 기준이지만 KST 00:00을 의미
}

export function getLoaWeekRange(weekOffset = 0) {
  const start = getLoaWeekStart()
  start.setUTCDate(start.getUTCDate() + weekOffset * 7)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  end.setUTCHours(14, 59, 59, 999) // KST 23:59:59
  return { start, end }
}

// API에 넘길 KST 날짜 문자열 "YYYY-MM-DD HH:MM" 생성
export function weekRangeStrings(weekOffset) {
  const { start, end } = getLoaWeekRange(weekOffset)
  const weekStart = start.toISOString().slice(0, 16).replace("T", " ")
  const endKST = new Date(end.getTime() + 9 * 60 * 60 * 1000)
  const weekEnd = endKST.toISOString().slice(0, 16).replace("T", " ")
  return { weekStart, weekEnd }
}

export function formatWeekLabel(weekOffset) {
  const { start, end } = getLoaWeekRange(weekOffset)
  const sm = start.getUTCMonth() + 1
  const sd = start.getUTCDate()
  const endKST = new Date(end.getTime() + 9 * 60 * 60 * 1000)
  const em = endKST.getUTCMonth() + 1
  const ed = endKST.getUTCDate()
  const prefix = weekOffset === 0 ? "이번 주" : weekOffset > 0 ? `+${weekOffset}주` : `${weekOffset}주`
  return `${prefix} (${sm}/${sd} 수 ~ ${em}/${ed} 화)`
}

export function formatDateLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number)
  const date = new Date(y, m - 1, d)
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"]
  return `📅 ${m}월 ${d}일 (${dayNames[date.getDay()]})`
}

export function groupRaidsByDate(raids) {
  const mobaChul = raids.filter(r => r.isMobaChul)
  const scheduled = raids.filter(r => !r.isMobaChul)
  const groups = {}
  for (const raid of scheduled) {
    if (!groups[raid.date]) groups[raid.date] = []
    groups[raid.date].push(raid)
  }
  const sortedDates = Object.keys(groups).sort()
  return { mobaChul, dateGroups: sortedDates.map(d => ({ date: d, raids: groups[d] })) }
}
