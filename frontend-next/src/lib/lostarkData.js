// 서포터 직업 목록 (이 4개만 서포터로 분류)
export const SUPPORTER_CLASSES = ["바드", "도화가", "홀리나이트", "발키리"]

// 레이드별 난이도별 최소 입장 레벨 (raid-create/page.js RAIDS 기준)
export const RAID_MIN_LEVELS = {
  "에키드나_노말": 1620, "에키드나_하드": 1640,
  "에기르_노말":   1660, "에기르_하드":   1680,
  "아브렐슈드_노말": 1670, "아브렐슈드_하드": 1690,
  "모르둠_노말":   1680, "모르둠_하드":   1700,
  "아르모체_노말": 1700, "아르모체_하드": 1720,
  "카제로스_노말": 1710, "카제로스_하드": 1730,
  "세르카_노말":   1710, "세르카_하드":   1730, "세르카_나이트메어": 1740,
  "지평의 성당_1단계": 1700, "지평의 성당_2단계": 1720, "지평의 성당_3단계": 1750,
}

// raidAlias + difficulty 조합으로 최소 레벨 조회
export function getMinLevel(raidAlias, difficulty) {
  return RAID_MIN_LEVELS[`${raidAlias}_${difficulty}`] || 0
}
