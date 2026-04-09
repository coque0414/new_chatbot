# 🗡️ LostArk Raid Reservation System

로스트아크 레이드 예약 시스템 - Discord 봇과 웹 대시보드를 연동한 레이드 파티 모집 플랫폼

## ✨ 주요 기능

### 🎮 Discord 봇
- 레이드 모집 공고 자동 생성 (임베드 + 버튼)
- 딜러/서포터 역할 구분 참가 (3:1 비율)
- 로스트아크 캐릭터 연동 (직업/레벨/전투력 표시)
- N종 기차 레이드 (1680~1730 레벨별 프리셋)
- 모집 취소/참가 취소/출발 버튼
- 레이드 출발 시 임시 음성채널 자동 생성 + 참가자 DM 발송
- 음성채널 자동 삭제 (전원 퇴장 시)
- N분 전 DM 알림 (10/20/30분 선택)

### 🌐 웹 대시보드
- Discord OAuth 로그인
- 레이드 생성 (단일/N종 기차)
- 내가 만든/참가한 레이드 목록
- 서버별 레이드 현황
- 캐릭터 연동 관리
- 봇 설정 (채널 지정, 공고 정리)
- 8가지 테마 (다크 2종 + 라이트 파스텔 6종)

## 🛠️ 기술 스택

| 분류 | 기술 |
|------|------|
| Frontend | Next.js 16, Tailwind CSS v4, shadcn/ui |
| Auth | NextAuth v4 (Discord OAuth) |
| Database | MongoDB Atlas |
| Discord | REST API (discord.js 미사용) |
| Gateway | Node.js WebSocket Worker |

## 🚀 시작하기

### 필수 조건
- Node.js 18+
- MongoDB Atlas 계정
- Discord 개발자 포털 앱
- 로스트아크 API 키

### 설치

1. 저장소 클론
```bash
git clone https://github.com/{username}/lostark-raid-system
cd lostark-raid-system/frontend-next
npm install
```

2. 환경 변수 설정
```bash
cp .env.example .env.local
# .env.local 파일에 값 입력
```

3. 개발 서버 실행
```bash
# Next.js
npm run dev

# Gateway Worker (별도 터미널)
cd ../gateway-worker
npm install
npm run dev
```

## 📁 프로젝트 구조

```
frontend-next/     Next.js 웹 대시보드
gateway-worker/    Discord Gateway WebSocket 워커
```

## 🔧 Discord 봇 설정

1. Discord 개발자 포털에서 앱 생성
2. Bot 토큰 발급
3. Interactions Endpoint URL 설정 (ngrok URL + /api/discord/interactions)
4. OAuth2 scope: identify, email, guilds

## 📝 환경 변수

```env
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

## 📸 스크린샷

(스크린샷 추가 예정)

## 📄 라이센스

MIT License
