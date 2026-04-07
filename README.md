# gateway-worker

Discord Gateway WebSocket 상시 연결 프로세스.  
`VOICE_STATE_UPDATE` 이벤트를 감지해서 레이드 임시 음성채널에 아무도 없으면 자동 삭제.

---

## 역할

Next.js(서버리스)는 Discord Gateway에 상시 연결할 수 없어서  
이 워커가 별도 프로세스로 상시 실행되며 Gateway를 담당한다.

- Discord Gateway WebSocket 연결 유지 (자동 재연결 포함)
- `GUILD_CREATE`로 시작 시 현재 음성 상태 초기화
- `VOICE_STATE_UPDATE`로 유저 입퇴장 추적
- 레이드 임시 음성채널에 아무도 없으면 즉시 삭제 + MongoDB 업데이트

---

## 설치 및 실행

### 1. 의존성 설치

```bash
cd C:\new_chatbot\gateway-worker
npm install
```

### 2. 환경 변수 설정

`.env` 파일에 값 입력 (`frontend-next/.env.local`과 동일):

```
DISCORD_BOT_TOKEN=your_bot_token_here
MONGODB_URI=your_mongodb_uri_here
```

### 3. 개발 실행 (파일 변경 시 자동 재시작)

```bash
npm run dev
```

### 4. 프로덕션 실행

**pm2 사용 (권장):**

```bash
# pm2 전역 설치 (최초 1회)
npm install -g pm2

# 워커 시작
pm2 start index.js --name gateway-worker

# 서버 재부팅 시 자동 시작 등록
pm2 startup
pm2 save

# 상태 확인
pm2 status
pm2 logs gateway-worker

# 재시작 / 중지
pm2 restart gateway-worker
pm2 stop gateway-worker
```

**systemd 사용 (Linux 서버):**

```ini
# /etc/systemd/system/gateway-worker.service
[Unit]
Description=Discord Gateway Worker
After=network.target

[Service]
WorkingDirectory=/path/to/gateway-worker
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
EnvironmentFile=/path/to/gateway-worker/.env

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable gateway-worker
systemctl start gateway-worker
systemctl status gateway-worker
```

---

## Next.js와의 관계

| 구분 | Next.js (frontend-next) | gateway-worker |
|------|------------------------|----------------|
| 역할 | 웹 UI, REST API, Discord interactions | Gateway WebSocket 상시 연결 |
| 실행 방식 | `npm run dev` (개발) / Vercel (배포) | 별도 Node.js 프로세스 |
| Discord 통신 | REST API (요청/응답) | WebSocket (실시간 이벤트) |
| DB 접근 | 동일 MongoDB Atlas | 동일 MongoDB Atlas |

두 프로세스는 완전히 독립적으로 실행된다.  
같은 MongoDB를 바라보는 것으로 데이터를 공유한다.

---

## 음성채널 삭제 로직

```
VOICE_STATE_UPDATE 수신
  └─ channel_id === null (퇴장)
       └─ 이전 채널 유저 수 확인
            └─ 0명이면 → Raid.findOne({ guildId, voiceChannelId })
                 └─ 레이드 채널이면 → DELETE /channels/{voiceChannelId}
                      └─ raid.voiceChannelId = null 저장
```

시작 시 `GUILD_CREATE` 이벤트로 현재 모든 음성 상태를 메모리에 초기화하기 때문에  
워커 재시작 직후에도 정확하게 채널 인원을 파악할 수 있다.

---

## 봇 권한

Discord 개발자 포털에서 아래 권한이 필요하다:

- **Gateway Intent**: `GUILD_VOICE_STATES` (intents: 128)
- **Bot Permission**: `MANAGE_CHANNELS` (음성채널 삭제)

Privileged Intents는 해당 없음 (`GUILD_VOICE_STATES`는 일반 intent).
