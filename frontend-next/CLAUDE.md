# 로스트아크 레이드 예약 시스템 - CLAUDE.md

## 프로젝트 개요
"로미니" — 로스트아크 레이드 예약 시스템 포트폴리오 프로젝트.
Next.js 웹 대시보드 + Discord 봇을 연동하여, 웹과 Discord 양쪽에서 레이드 파티를 모집/관리할 수 있는 시스템.
단발성 레이드 모집 외에 N종 기차, 주간 고정 파티, 후원 시스템, 관리자 통계까지 확장됨.
배포: Vercel(Next.js) + 상시 실행 Node 프로세스(gateway-worker).

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js 16 (App Router, Turbopack), Tailwind CSS v4, shadcn/ui |
| Auth | NextAuth v4 (Discord OAuth) |
| Database | MongoDB Atlas (mongoose, 직접 연결 문자열, SRV DNS 미사용) |
| Discord | REST API 직접 호출 (discord.js 미사용) |
| Gateway | gateway-worker (Node.js 상시 실행, WebSocket + 스케줄러 + Vercel 워밍업) |
| 서명 검증 | tweetnacl |
| 배포 | Vercel (frontend-next), 별도 서버/VPS (gateway-worker) |
| 터널 | ngrok (개발) |

---

## 프로젝트 경로
```
C:\new_chatbot\frontend-next   (Next.js)
C:\new_chatbot\gateway-worker  (Gateway Worker)
```
`backend/`, `frontend/`, `chroma_db/` 는 이 프로젝트 이전의 별도 RAG 챗봇 실험 코드로, 현재 레이드 예약 시스템과는 무관 (레거시, git 추적 안 함).

### 주요 파일 구조
```
frontend-next/src/
├── app/
│   ├── (auth)/login/page.js
│   ├── (main)/
│   │   ├── dashboard/page.js
│   │   ├── raid-create/page.js
│   │   ├── raids/[id]/page.js
│   │   ├── raids/train/[trainId]/page.js
│   │   ├── train-raids/[id]/page.js
│   │   ├── fixed-raids/{layout,page}.js   # 주간 고정 파티
│   │   ├── board/page.js                  # 요일별 레이드 일정 보드
│   │   ├── bot-settings/page.js
│   │   ├── characters/page.js
│   │   └── chat/page.js                   # 대화형 레이드 생성 에이전트 UI (좌: 채팅 / 우: 초안 패널)
│   ├── admin/
│   │   ├── stats/page.js                  # 명령어/버튼 사용량 대시보드
│   │   └── donations/page.js              # 후원 내역 관리
│   ├── guide/page.js                      # 공개 사용 가이드
│   ├── privacy/page.js, terms/page.js
│   ├── sitemap.js
│   └── api/
│       ├── auth/[...nextauth]/route.js
│       ├── raids/
│       │   ├── route.js                  # GET/POST - 단일 레이드
│       │   ├── [id]/route.js             # GET/DELETE/PATCH
│       │   ├── [id]/join/route.js, [id]/leave/route.js
│       │   ├── cleanup/route.js
│       │   └── fix-train/route.js
│       ├── train-raids/
│       │   ├── route.js                  # GET/POST - N종 기차 (별도 컬렉션)
│       │   ├── [id]/route.js
│       │   └── train/[trainId]/route.js
│       ├── fixed-raids/
│       │   ├── route.js, [id]/route.js
│       │   ├── members/route.js
│       │   └── admin-check/route.js
│       ├── characters/{route.js, verify/route.js}
│       ├── donation/{route.js, account/route.js, confirm/route.js}
│       ├── stats/route.js
│       ├── admin/migrate-train-raids/route.js
│       ├── scheduler/check/route.js
│       ├── agent/
│       │   ├── chat/route.js             # POST - 대화형 레이드 생성 에이전트 (Claude tool use)
│       │   └── confirm/route.js          # POST - 초안 확정 → raidService.createRaid() 호출
│       └── discord/
│           ├── interactions/route.js      # 봇 상호작용 핵심 (2600+ 라인)
│           ├── bot-invite/route.js
│           ├── guilds/route.js
│           ├── guild-settings/{route.js, all/route.js}
│           ├── channels/route.js
│           ├── create-channel/route.js
│           └── setup-raid-channel/route.js
├── lib/
│   ├── mongodb.js
│   ├── discord.js          # REST API 클라이언트, 임베드/버튼 빌더
│   ├── discordDM.js        # DM 발송 로직 분리
│   ├── raidLaunch.js       # 레이드 출발 처리 (음성채널 생성 등)
│   ├── raidService.js      # createRaid() — 레이드 생성 공용 로직 (단일/기차/N수 전부 포함, raid-create 폼 + 에이전트 confirm이 공유)
│   ├── raidCatalog.js      # RAIDS — 레이드 카탈로그 순수 데이터 (raid-create 폼 + 에이전트가 공유)
│   ├── agentExtraction.js  # 대화형 에이전트용 원문 텍스트 결정론적 매칭 함수 모음
│   ├── lostarkApi.js       # 로스트아크 오픈API 호출 래퍼
│   ├── lostarkData.js      # SUPPORTER_CLASSES, RAID_MIN_LEVELS, getMinLevel
│   ├── trainData.js        # TRAIN_PRESETS
│   ├── loaWeek.js          # 로아 주간 초기화(수요일 09:00 KST) 기준 유틸
│   ├── stats.js            # BotStats 집계 헬퍼
│   ├── themes.js           # 테마 상수
│   ├── utils.js
│   └── models/
│       ├── Raid.js           # 단일 레이드
│       ├── TrainRaid.js      # N종 기차 (Raid와 분리된 컬렉션)
│       ├── FixedRaid.js      # 주간 고정 파티 (슬롯 기반)
│       ├── GuildSettings.js
│       ├── UserCharacters.js
│       ├── Donation.js       # 후원 내역
│       ├── BotStats.js       # 명령어/버튼 사용 통계 (일별)
│       ├── NsuSession.js     # "같이참가" 임시 선택 상태 (TTL 10분)
│       └── AgentSession.js   # 대화형 레이드 생성 에이전트 세션 (TTL 30분)
├── components/
│   ├── layout/DashboardLayout.js  # 1280px 고정, sticky 사이드바, 테마
│   └── ui/                        # shadcn 기반 (button, card, dialog, sheet, dropdown-menu 등)
└── scripts/
    ├── register-commands.js       # 슬래시 커맨드 등록 스크립트
    └── cleanup-abrelshud.js       # 1회성 데이터 정리 스크립트
```

---

## 환경 변수

.env.local:
```
DISCORD_BOT_TOKEN=
DISCORD_PUBLIC_KEY=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
MONGODB_URI=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
LOSTARK_API_KEY=
SCHEDULER_SECRET=
```

gateway-worker/.env:
```
DISCORD_BOT_TOKEN=
MONGODB_URI=
SCHEDULER_SECRET=
```

---

## 실행 방법

```bash
# 1. Next.js 먼저
cd C:\new_chatbot\frontend-next
rmdir /s /q .next   # 캐시 문제 시
npm run dev

# 2. Gateway Worker (Next.js 뜬 후)
cd C:\new_chatbot\gateway-worker
npm run dev
```

`vercel.json`에서 `/api/discord/interactions`(maxDuration 10s), `/api/scheduler/check`(maxDuration 30s) 함수 시간 제한을 확장 설정.

---

## 완료된 기능

### 웹
- [x] Discord OAuth 로그인 (guilds scope)
- [x] 다크/라이트 테마 시스템 (8가지, 기본 다크)
- [x] DashboardLayout (1280px 고정, sticky 사이드바)
- [x] 대시보드 - 레이드 목록, Show More, 서버별 현황
- [x] 레이드 생성 - 단일/N종 기차 (캐릭터 선택 필수)
- [x] 레이드 상세 - 캐릭터 정보 표시, 단일/기차 분리 라우트
- [x] 요일별 레이드 일정 보드 (board)
- [x] 주간 고정 파티 (fixed-raids) - 슬롯 예약, 다음 주 시간 오버라이드
- [x] 봇 설정 - 채널 지정, 레이드 정리
- [x] 캐릭터 연동 - 전투력 포함, 자동 갱신
- [x] 후원 시스템 (donation) - 계좌 안내, 입금 확인 요청
- [x] 관리자 페이지 - 사용 통계(stats), 후원 내역(donations)
- [x] 공개 가이드/이용약관/개인정보처리방침, sitemap
- [x] 대화형 레이드 생성 에이전트 (chat) - Claude API tool use, 단일 레이드 MVP (N수/기차는 스코프 밖)

### Discord
- [x] 버튼 2행 (참가/취소/모집취소/명단)
- [x] 모집취소 Modal, 기한 만료 비활성화
- [x] 출발 버튼 (음성채널 + DM)
- [x] 캐릭터 Select Menu (레벨/직업/전투력)
- [x] N종 기차 (train_ prefix, TrainRaid 별도 컬렉션)
- [x] "같이참가"(NSU) - 여러 캐릭터 동시 참가, NsuSession으로 임시 선택 상태 유지(TTL 10분)
- [x] 캐릭터 인증 메시지 (등록/수정/삭제)
- [x] 레이드 생성 채널 드롭다운
- [x] 봇 초대 링크 라우트

### 알림 / 자동화
- [x] 5분마다 스케줄러 자동 실행 (gateway-worker)
- [x] N분 전 DM + 음성채널
- [x] 전원 퇴장 시 음성채널 삭제
- [x] 5분마다 캐릭터 정보 자동 갱신 (checkCharRefresh)
- [x] 4분마다 Vercel 서버리스 함수 워밍업 핑 (콜드 스타트 방지)

---

## Raid / TrainRaid / FixedRaid 모델

### Raid (단일 레이드)
```
raidName, raidAlias, raidTag, difficulty, maxPlayers
date, time, isMobaChul
discordChannelId, discordMessageId, guildId
hostId, hostName, hostImage
participants: [{
  userId, userName, userImage, role,     # role: "dealer" | "support" (호스트가 "none"이면 participants에 아예 안 들어감)
  characterName, characterClass, characterLevel, characterCombatPower
}]
status: 모집중|모집완료|진행중|완료|취소|출발완료
dmSent, voiceChannelId, voiceChannelCreatedAt, notifyMinutesBefore
totalRounds, rounds: [{ order, participants: [...] }]   # N수(같은 레이드 반복 모집) — totalRounds>=2면 top-level participants는 비우고 라운드별로 채움
```
호스트의 참가 역할(`hostRole`, `lib/raidService.js`의 `createRaid()` 파라미터 및 웹 폼 값)은 `"dealer" | "support" | "none"` 3-state:
- `"dealer"` / `"support"`: 호스트도 참가자로 등록되고 해당 역할로 `participants`(또는 N수면 `rounds[n].participants`)에 들어감
- `"none"`: 호스트는 모집만 하고 본인은 참가하지 않음 (participants에 안 들어감, 캐릭터 정보도 필요 없음)

N수 모드에서 라운드별로 호스트가 다른 캐릭터로 참가할 수 있는데, 이건 `createRaid()`의 `hostNsuCharacters`/`hostNsuRoles` **파라미터**(라운드 순번을 키로 하는 캐릭터/역할 맵)로 받아서 서버가 `rounds` 배열로 조립하는 것이지, Raid 문서 자체에 그 이름 그대로 저장되는 필드는 아님.

**`hostNsuCharacters`/`hostNsuRoles`(호스트의 라운드별 캐릭터)와 `NsuSession`/`join_nsu_`(Discord 참가자가 여러 캐릭터로 동시 참가하는 "같이참가" 흐름)는 이름만 비슷할 뿐 완전히 별개 기능이다.** 전자는 `raid-create/page.js`의 웹 폼에서 주최자가 N수 레이드를 만들 때만 쓰이고, 후자는 `app/api/discord/interactions/route.js`의 Discord 참가 흐름 전용이다 — 두 코드 사이에 교차 참조 없음(grep으로 확인).

### TrainRaid (N종 기차, 별도 컬렉션)
```
trainKey, trainLabel
trainRaids: [{ order, raidAlias, raidTag, raidName, difficulty, maxPlayers }]
maxPlayers, isMobaChul, date, time
discordChannelId, discordMessageId, guildId
hostId, hostName, hostImage
participants: [{ userId, userName, userImage, role, characterName, characterClass, characterLevel, characterCombatPower, joinedAt }]
status: 모집중|모집완료|취소|출발완료
dmSent, voiceChannelId, voiceChannelCreatedAt, notifyMinutesBefore
```
과거에는 Raid에 isTrain/trainLabel/trainRaids로 통합되어 있었으나, 현재는 TrainRaid로 분리됨.
`api/raids/fix-train`, `api/admin/migrate-train-raids`는 통합→분리 마이그레이션용 라우트.

### FixedRaid (주간 고정 파티)
```
guildId, weekday(0=수~6=화), time, raidAlias, raidName, raidTag, difficulty, difficulty_level, maxPlayers
slots: [{ slotIndex, isSupporter, discordId, serverNick, characterName, characterClass, characterLevel, characterCombatPower, role }]
notifyEnabled
nextWeekOverride: { time, active }   # 다음 주만 시간 변경
```

### 기타 모델
- `Donation`: discordId, discordName, senderName, amount, message, status(pending/confirmed), confirmedAt
- `BotStats`: date별 commandUsage / buttonClicks / raidsCreated(web,discord) / raidsJoined(web,discord) 집계
- `NsuSession`: userId+raidId 유니크, selections(Map), createdAt TTL 600초 — "같이참가" 흐름 중 캐릭터 선택 임시 저장

---

## 대화형 레이드 생성 에이전트 (`chat` 페이지, `api/agent/*`)

자연어로 레이드를 예약하는 기능. **현재 MVP는 단일 레이드만 지원 — N수/기차 모드는 스코프 밖**(확정 시 `createRaid()`에 `totalRounds: 1, hostNsuCharacters: null, hostNsuRoles: null, trains: null`로 고정 전달).

### 아키텍처
```
유저 메시지
  → POST /api/agent/chat
      → Claude API (claude-haiku-4-5-20251001, tool use: update_raid_draft)
      → 초안(draft) 갱신, AgentSession에 저장
  → (여러 턴 반복)
  → POST /api/agent/confirm
      → lib/raidService.js의 createRaid() 재사용 (raid-create 웹 폼과 동일 함수)
```

### 핵심 설계 원칙 — "모델 판단보다 서버 결정론적 검증을 신뢰"
Claude(특히 Haiku)가 별칭 오판("노벨"을 하드로 착각), difficultyLevel/isMobaChul 임의 hallucination 등을 종종 일으켜서, 아래 필드들은 **Claude의 tool call 값을 신뢰하지 않고 서버가 직접 확정**한다:

- **raidTag / maxPlayers**: `raidAlias`가 정해지면 매 턴 `lib/raidCatalog.js`의 카탈로그 값으로 무조건 덮어씀 (Claude가 지어낼 수 없게).
- **raidAlias / difficulty**: `lib/agentExtraction.js`의 `matchAliasFromText()`가 이번 턴 유저 원문을 `RAIDS[].aliases`/`difficultyAliases` 테이블과 직접 대조해서, 매칭되면 그 결과로 확정(Claude 판단 무시). "노벨" 같은 난이도 지정 별칭은 raidAlias+difficulty를 동시에 확정.
- **difficultyLevel**: `matchDifficultyLevelFromText()`가 `["헤딩","트라이","클경","반숙","숙련","숙제"]` 중 원문에 실제로 등장하는 키워드만 인정. 매칭 안 되면 Claude가 뭘 보냈든 무시하고 **기존 값 유지**(리셋 아님).
- **isMobaChul**: `matchIsMobaChulFromText()`가 `["모바출","모이면","모이는대로","채워지면","차면","다 모이면","어느정도 모이면"]` 키워드 매칭. 매칭 안 되면 difficultyLevel과 동일하게 기존 값 유지 — 단, 세션 첫 턴(아직 메시지 없음)에는 실제 기본값(`false`, `models/Raid.js`/`raid-create` 폼과 동일)으로 초기화.
- **hostRole**: `/api/agent/confirm`에서 확정된 `hostCharacterName`으로 `UserCharacters`를 조회해 실제 `class`가 `SUPPORTER_CLASSES`에 속하는지로 재검증 — Claude가 dealer/support를 잘못 판단해도 서버가 교정.
- **raidAlias+difficulty 조합 자체**: `/api/agent/confirm`에서 카탈로그의 `difficulties[].name`과 실제로 일치하는지 최종 검증(400으로 차단) — chat 단계 프롬프트 유도의 이중 방어.
- **hostCharacterName**: `/api/agent/confirm`에서 `UserCharacters.characters`(top-level, 1계정만 — 웹 폼과 동일 범위, 2~4계정 `accounts[]`는 미지원) 중 정확히 일치하는 이름이 없으면 400.

### AgentSession (`models/AgentSession.js`)
- `userId, guildId, messages: [{role, content, toolCall, timestamp}], draft: {...}, status`
- `status`: `"collecting" | "ready" | "confirmed" | "cancelled"`
- `updatedAt` 기준 **TTL 30분** 자동 삭제
- 세션당 **40턴 캡** — 도달하면 Claude API 호출 없이 즉시 "대화가 길어졌어요, 새로 시작해주세요" 응답(비용 방어)

### 프롬프트 캐싱
system 프롬프트를 두 부분으로 분리:
- **캐싱 대상**(`cache_control: { type: "ephemeral" }`): 오늘 날짜(시각 없이 날짜 단위만 — 시각까지 넣으면 매 요청 캐시가 깨짐), 유저 캐릭터 목록, 레이드/난이도/별칭 카탈로그, 지침
- **캐싱 밖**(매 턴 갱신): 최근 대화 맥락(최근 2턴, user+assistant 최대 4개 메시지)과 현재 초안 상태(JSON)를 유저 메시지 앞에 `[현재 초안: {...}]` 프리픽스로 붙여서 전달

### API
**`POST /api/agent/chat`** — `{ sessionId?, message, guildId }` → `{ sessionId, reply, draft, ready }`
**`POST /api/agent/confirm`** — `{ sessionId }` → 성공 `{ success: true, raid }` / 실패 `{ error }`(400/404/500, 세션은 `status: "ready"`로 유지되어 재시도 가능)

### UI (`chat/page.js`)
좌: 채팅(유저 메시지 우측/앰버, 에이전트 좌측), 우: 고정폭 초안 패널(읽기 전용, 입력 필드 없음). **필드 수정은 전부 채팅 재발화로만 처리** — 패널은 "이대로 만들기" 버튼(`ready` 여부에 따라 강조 스타일 전환)만 있음. 확정 성공 시 생성된 레이드 링크(`/raids/[id]`) + "새 레이드 만들기" 버튼으로 세션 초기화. 새로고침 시 세션 유지는 미지원(새 대화로 시작).

### 레이드별 난이도 체계
`difficulty`는 고정 enum이 아니라 레이드마다 다른 `raidCatalog.js`의 `difficulties[].name` 기준이다. 대부분(카제로스 레이드 6종)은 노말/하드 2단계지만, 세르카·벨가르딘은 나이트메어 포함 3단계이고, 지평의 성당은 노말/하드가 아니라 1단계/2단계/3단계다.

`raidCatalog.js`의 `aliases` 구조: 레이드별 일반 별칭(`aliases`, 예: 벨가르딘 → "벨가")과 "이름+난이도 복합" 별칭(`difficultyAliases`, 예: "노벨"→벨가르딘+노말)이 함께 있고, `matchAliasFromText()`가 이걸로 `raidAlias`+`difficulty`를 동시에 확정할 수 있다.

---

## Discord interactions 패턴 (`app/api/discord/interactions/route.js`, 2600+ 라인)

단일 레이드 (negative lookahead로 `train_` prefix 제외):
```js
/^join_dealer_(?!train_)(.+)$/
/^join_support_(?!train_)(.+)$/
/^leave_(?!train_)(.+)$/
/^cancel_raid_(?!train_)(.+)$/
/^roster_(?!train_)(.+)$/
/^delete_voice_(?!train_)(.+)$/
/^select_char_(dealer|support)_(?!train_)(.+)$/
```

기차 (`train_` prefix):
```js
/^join_dealer_train_(.+)$/
/^join_support_train_(.+)$/
/^leave_train_(.+)$/
/^cancel_raid_train_(.+)$/
/^roster_train_(.+)$/
/^start_raid_train_(.+)$/
/^delete_voice_train_(.+)$/
/^select_char_(dealer|support)_train_(.+)$/
```

기타 주요 커스텀 ID:
- `raid_create_start`, `train_create_start`, `raid_select_raid`, `raid_select_diff_{level}`, `train_select_level`, `train_select_preset_{level}`, `train_select_players_{level}_{presetId}`
- `depart_raid_{id}` (출발), `join_nsu_{id}` / `select_nsu_char_{n}_{id}` (같이참가 흐름)
- `char_auth_register/update/select_account/remove` + 대응 모달 `char_auth_modal_register/update/update_{n}/remove`
- 모달(type 5): `cancel_confirm_{id}`, `cancel_confirm_train_{id}`, `char_verify_{role}_{id}`, `char_verify_{role}_train_{id}`, `char_verify_nsu_{id}`, `train_submit_{level}_{presetId}_{maxPlayers}`, `raid_submit_{level}_{id}`

Select Menu (type 3): `select_char_{role}_{id}`, `raid_select_raid`, `train_select_level`, `train_select_preset_{level}`

---

## 테마 시스템

| id | 종류 |
|----|------|
| dark (기본) | 다크 남색 |
| dark-gray | 다크 그레이 |
| light-white | 화이트 |
| light-pink | 핑크 파스텔 |
| light-yellow | 옐로우 파스텔 |
| light-green | 그린 파스텔 |
| light-blue | 블루 파스텔 |
| light-purple | 퍼플 파스텔 |

localStorage 키: "themeId" / 기본값: "dark"

---

## N종 기차 프리셋

1680_3, 1700_3
1710_3_성당, 1710_3_아르모체, 1710_4
1720_3_성당, 1720_3_아르모체, 1720_4
1730_3_성당, 1730_3_아르모체, 1730_4

---

## 로아 주간 초기화 기준 (`lib/loaWeek.js`)

한 주 = 수요일 09:00 KST ~ 다음 주 수요일 08:59 KST. `getLoaWeekStart`, `getLoaWeekRange(weekOffset)`, `weekRangeStrings`, `formatWeekLabel`, `formatDateLabel`, `groupRaidsByDate`(모바출/날짜별 그룹핑) 제공. board, fixed-raids 페이지에서 사용.

---

## 알려진 이슈 및 해결법

### Turbopack 캐시
```bash
rmdir /s /q .next && npm run dev
```

### Gateway Worker 순서
Next.js 먼저 실행 후 Gateway Worker 실행.

### Next.js 16 params
```js
const { id } = await params  // await 필수
```

### Discord 버튼 충돌
단일 핸들러에 (?!train_) negative lookahead 필수.

### Discord accessToken
서버 목록 안 나오면 로그아웃 후 재로그인.

### 로아 API 전투력
data.ArmoryProfile.CombatPower → "5,001.20" → Math.round(parseFloat(str.replace(/,/g,"")))

### Vercel 콜드 스타트
gateway-worker가 4분마다 `/api/discord/interactions`, `/api/raids`, `/api/characters`를 핑하여 서버리스 함수 워밍업 유지 (`pingVercel` in gateway-worker/index.js).

### guildId 선택 UI 중복 (해결됨)
`raid-create`, `fixed-raids`, `bot-settings`, `board`, `dashboard`, `chat` 6개 페이지가 전부 동일한 패턴이라고 여겨졌으나, 조사 결과 진짜 중복은 2쌍뿐이었음. 각각 공용 컴포넌트로 추출 완료:

- `components/GuildSelectDropdown.js` — `raid-create`(단일탭+기차탭)와 `chat`이 공유. `<select>` + GuildSettings 공고채널 상태 박스. 부수효과(GuildSettings 조회, chat의 `resetSession()` 등)는 컴포넌트 밖 페이지 쪽에 유지.
- `components/GuildPillSelector.js` — `fixed-raids`와 `board`가 공유. pill 버튼 + 목록 로드 시 첫 번째 길드 자동 선택(`autoSelectFirst` prop, 기본 `true`). 다운스트림 fetch(fixed-raids 3종/board 1종)는 각 페이지 기존 `useEffect`에 그대로 유지.

`dashboard`(아코디언), `bot-settings`(전체 렌더 + `guildIds` 배치 조회)는 의도적으로 추출 대상에서 제외 — 선택기가 아니라 구조적으로 다른 UI 개념(조사로 확인됨).

### 로컬 dev 서버 중복 실행
같은 세션(또는 여러 세션)에서 백그라운드로 띄운 `npm run dev`가 종료되지 않고 계속 남아있는 경우가 있음 — `npm`이 자식 프로세스(`next dev`)에 SIGTERM을 전달하지 않아서, npm 프로세스만 죽이면 실제 서버는 계속 살아있음. 두 인스턴스가 같은 `.next` 캐시에 동시에 쓰기를 시도하면 Turbopack 캐시가 깨지면서 임의의 라우트가 500을 뱉는 증상으로 나타남(`rmdir /s /q .next`로도 근본 해결 안 됨, 프로세스부터 정리해야 함). 작업 전후로 `node.exe` 프로세스 중 `frontend-next`를 가리키는 게 여러 개 있는지 확인 권장.
