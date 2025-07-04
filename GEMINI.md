**프로젝트 지침**
너는 MCP를 사용할 수 있어.
다음 예시들을 살펴보고 적절히 활용해줘.

# 회의실 음성 녹음 시스템 기술 스택

## 🎯 프로젝트 개요

- **기능**: 회의방 생성 → 링크 공유 → 참여자 입장 → 방장 제어로 음성 녹음 → 개별 파일 업로드
- **핵심**: 실시간 제어 신호 + 개별 음성 녹음 + 파일 업로드

---

## 🚀 Frontend (React + TypeScript)

### 프로젝트 초기 설정

```bash
npm create vite@latest meeting-recorder -- --template react-ts
cd meeting-recorder && npm install
```

### 핵심 패키지

```bash
# 음성 녹음
npm install recordrtc @types/recordrtc

# 실시간 통신 (회의 제어용)
npm install socket.io-client @types/socket.io-client

# 파일 업로드
npm install axios @types/axios

# UI 컴포넌트
npm install lucide-react  # 아이콘
npm install clsx          # 조건부 클래스

# 라우팅
npm install react-router-dom @types/react-router-dom

# 유틸리티
npm install uuid @types/uuid
```

### 개발 도구

```bash
npm install -D typescript @types/react @types/react-dom @types/node
```

---

## 🔧 Backend (Node.js + Express + TypeScript)

### 프로젝트 초기 설정

```bash
npm init -y
npm install express @types/express typescript ts-node nodemon
npm install cors helmet morgan dotenv
npm install @types/cors @types/helmet @types/morgan
```

### 핵심 패키지

```bash
# 실시간 통신 서버
npm install socket.io @types/socket.io

# 파일 업로드 처리
npm install multer @types/multer

# 데이터베이스 (간단한 회의방 정보 저장)
npm install prisma @prisma/client

# 유틸리티
npm install uuid @types/uuid
```

---

## 📱 주요 기능별 구현

### 1. 회의방 관리

```typescript
// Frontend - 방 생성
interface Room {
  id: string;
  hostId: string;
  participants: string[];
  status: 'waiting' | 'recording' | 'ended';
  createdAt: Date;
}

// Backend - DB 스키마 (Prisma)
model Room {
  id          String   @id @default(uuid())
  hostId      String
  status      String   @default("waiting")
  participants Json[]  @default([])
  createdAt   DateTime @default(now())
}
```

### 2. 실시간 제어 (Socket.IO)

```typescript
// 회의 제어 이벤트
interface MeetingEvents {
  "join-room": { roomId: string; userId: string; userName: string };
  "start-recording": { roomId: string };
  "stop-recording": { roomId: string };
  "participant-joined": { userId: string; userName: string };
  "recording-started": {};
  "recording-stopped": {};
}
```

### 3. 음성 녹음 (RecordRTC)

```typescript
// Frontend - 음성 녹음
import RecordRTC from "recordrtc";

const startRecording = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new RecordRTC(stream, {
    type: "audio",
    mimeType: "audio/wav",
  });
  recorder.startRecording();
};
```

### 4. 파일 업로드

```typescript
// Backend - 파일 업로드 API
app.post("/api/upload-audio", upload.single("audio"), (req, res) => {
  // 각 참여자의 음성 파일 저장
});
```

---

## 🛠 개발 스크립트

### Package.json 스크립트 (Frontend)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit"
  }
}
```

### Package.json 스크립트 (Backend)

```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:generate": "npx prisma generate",
    "db:migrate": "npx prisma migrate dev"
  }
}
```

---

## 🏃 실행 명령어

### 개발 환경 실행

```bash
# Frontend
npm run dev

# Backend
npm run dev

# 데이터베이스 설정
npx prisma init
npx prisma generate
npx prisma migrate dev
```

### 빌드 및 배포

```bash
# Frontend 빌드
npm run build
npm run preview

# Backend 빌드
npm run build
npm start
```

---

## 🎯 최소 기능 구현 순서

1. **기본 셋업**: React + Express + Socket.IO 연결
2. **회의방 생성**: UUID 기반 방 생성 및 링크 생성
3. **참여자 입장**: 링크를 통한 방 참여 기능
4. **실시간 제어**: 방장의 녹음 시작/종료 신호 전달
5. **음성 녹음**: 각 참여자 개별 음성 녹음
6. **파일 업로드**: 녹음 종료 시 각자의 파일 서버 업로드

---

## 📋 제외된 기능 (추후 확장 가능)

- ~~STT (Whisper API)~~ - 음성 전사 기능
- ~~실시간 채팅~~ - 메시지 기능
- ~~인증 시스템~~ - 로그인/회원가입
- ~~복잡한 상태 관리~~ - Redux 등
- ~~테스트 코드~~ - 초기 개발 단계 제외

그리고 "~/service/conRec" 폴더에서 작업해줘.

그리고 다음 지침을 지켜줘.

1. 먼저 project_plan.md 이 있으면 읽어보고 계속 진행할것. 없으면 작성할 것
2. 프로젝트 지식에 있는 목록과 기능 리스트를 구현할 수 있도록 가이드라인을 만들어야 해.
3. 개발 시, 최소 20개의 웹사이트를 연구해야 해. 각 웹사이트 정보는 틀릴 수도 있어. 그래서 검증이 필요하고 너가 분석해야 해. 따라서 많은 웹페이지를 분석해서, 그 내용에 근거해 또 다른 검색할
   정보를 찾아내. 그런 식으로 심층적으로 분석해줘.
4. MVP( Minimum Viable Product는 최소한의 기능을 가진 제품) 기능만 먼저 만들어라. 너무 과도한 개발을 하지마라.
5. 파일을 하나 만들 때마다, 작업이 하나 진행되었으니, 그에 맞게 project_plan.md 파일을 업데이트해줘.
6. 긴 파일은 3개나 4개로 나누어서 작업해줘.
7. 각 파일이 18kb를 초과하지 않도록 긴 내용은 미리 여러 개의 파일로 기획하여 진행해줘.
8. ~/service/conRec 이 폴더에서 작업 진행해.
9. 작업은 각종 언어, 라이브러리나, 프레임워크의 버전을 정확히 명시하여 코딩에 헤깔림이 없도록 할것.
10. 폴더를 잘 살펴보고 중복해서 문서를 쓰거나 코딩을 하지마라.
11. 기능을 하나라도 개발했으면 실행되도록 하고 이후에 하나씩 기능 증분을 만들어 가라.
