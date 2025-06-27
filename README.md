# conRec - 회의실 음성 녹음 시스템

웹 브라우저 기반 회의실 음성 녹음 시스템입니다. 개별 녹음과 실시간 제어로 고품질 회의록을 생성합니다.

## 🎯 프로젝트 개요

- **목표**: 웹 브라우저만으로 사용할 수 있는 회의 녹음 시스템
- **특징**: 개별 녹음 + 호스트 중앙 제어 + AI 전사
- **기술**: React + TypeScript + Node.js + Socket.IO + MongoDB

## 🛠 기술 스택

### Frontend
- **Framework**: React 18.3.1 + TypeScript 5.7.2
- **Build Tool**: Vite 6.0.0
- **Styling**: Tailwind CSS 3.4.0
- **Audio**: RecordRTC 5.6.2
- **Real-time**: socket.io-client 4.8.0
- **State**: Zustand 5.0.0

### Backend
- **Runtime**: Node.js 20.x LTS
- **Framework**: Express.js 4.21.0
- **Real-time**: Socket.io 4.8.0
- **Database**: MongoDB 7.0+
- **File Upload**: multer 1.4.5
- **STT**: OpenAI Whisper API

## 📁 프로젝트 구조

```
conRec/
├── frontend/                    # React 웹 클라이언트
│   ├── src/
│   │   ├── components/         # UI 컴포넌트
│   │   ├── pages/             # 페이지 컴포넌트
│   │   ├── services/          # API 및 Socket 서비스
│   │   ├── hooks/             # Custom React Hooks
│   │   ├── stores/            # Zustand 상태 관리
│   │   ├── types/             # TypeScript 타입 정의
│   │   └── utils/             # 유틸리티 함수
│   └── package.json
├── backend/                     # Node.js 서버
│   ├── src/
│   │   ├── controllers/       # API 컨트롤러
│   │   ├── models/            # 데이터 모델
│   │   ├── routes/            # API 라우트
│   │   ├── services/          # 비즈니스 로직
│   │   ├── middleware/        # 미들웨어
│   │   ├── config/            # 설정 파일
│   │   └── utils/             # 유틸리티 함수
│   ├── uploads/               # 임시 파일 저장
│   └── package.json
├── docs/                        # 프로젝트 문서
├── project_plan.md             # 프로젝트 계획서
└── README.md                   # 이 파일
```

## 🚀 설치 및 실행

### 사전 요구사항

- Node.js 18.0.0 이상
- NPM 8.0.0 이상
- MongoDB 6.0 이상 (로컬 또는 MongoDB Atlas)

### 1. 프로젝트 클론

```bash
git clone <repository-url>
cd conRec
```

### 2. 환경 변수 설정

#### Backend 환경 변수 (.env)
```bash
cd backend
cp .env.example .env
```

`.env` 파일 편집:
```bash
# 서버 설정
NODE_ENV=development
PORT=3000

# 데이터베이스
MONGODB_URI=mongodb://localhost:27017/conrec

# JWT 설정
JWT_SECRET=your_super_secure_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=24h

# CORS 설정
CORS_ORIGIN=http://localhost:5173

# OpenAI API (STT)
OPENAI_API_KEY=your_openai_api_key_here
```

#### Frontend 환경 변수 (.env)
```bash
cd ../frontend
```

`.env` 파일은 이미 설정되어 있습니다:
```bash
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
VITE_MAX_PARTICIPANTS=10
```

### 3. 의존성 설치

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd ../frontend
npm install
```

### 4. 데이터베이스 준비

MongoDB를 실행해주세요:
```bash
# 로컬 MongoDB 실행
mongod

# 또는 MongoDB Atlas 사용
# 위의 MONGODB_URI를 Atlas 연결 문자열로 변경
```

### 5. 서버 실행

#### Backend 서버 (개발 모드)
```bash
cd backend
npm run dev
```

서버가 http://localhost:3000에서 실행됩니다.

#### Frontend 서버 (개발 모드)
```bash
cd frontend
npm run dev
```

프론트엔드가 http://localhost:5173에서 실행됩니다.

### 6. 브라우저에서 확인

http://localhost:5173 에 접속하여 애플리케이션을 확인할 수 있습니다.

## 📋 사용 방법

### 1. 회의방 생성
1. 메인 페이지에서 "회의방 생성하기" 클릭
2. 이름과 최대 참여자 수 입력
3. 회의방 생성 후 링크 공유

### 2. 회의 참여
1. "회의 참여하기" 클릭 또는 공유받은 링크 클릭
2. 회의 ID와 이름 입력
3. 마이크 권한 허용

### 3. 녹음 제어
- **호스트**: 빨간 녹음 버튼으로 모든 참여자의 녹음 제어
- **참여자**: 개별 마이크 on/off 가능
- **녹음 완료**: 자동으로 파일 업로드 및 전사 처리

## 🔧 개발 스크립트

### Backend
```bash
npm run dev          # 개발 서버 실행
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버 실행
npm run type-check   # TypeScript 타입 검사
```

### Frontend
```bash
npm run dev          # 개발 서버 실행
npm run build        # 프로덕션 빌드
npm run preview      # 빌드 미리보기
npm run type-check   # TypeScript 타입 검사
```

## 🧪 개발 상태

### 완료된 기능 ✅
- [x] 프로젝트 초기 설정
- [x] TypeScript 타입 정의
- [x] 기본 페이지 구조 (Home, Create, Join, Meeting)
- [x] 데이터베이스 모델 (Room, RecordingFile)
- [x] 기본 미들웨어 (에러 핸들링, 로깅)
- [x] 설정 파일 (config, database)

### 진행 중인 기능 🚧
- [ ] Socket.io 실시간 통신
- [ ] RecordRTC 브라우저 녹음
- [ ] 파일 업로드 API
- [ ] OpenAI Whisper STT 통합

### 향후 계획 📅
- [ ] 실시간 채팅
- [ ] 화면 공유 녹화
- [ ] 회의록 PDF 내보내기
- [ ] 모바일 앱

## 🐛 알려진 이슈

현재 알려진 주요 이슈는 없습니다. 이슈가 발견되면 GitHub Issues에 보고해 주세요.

## 📚 API 문서

서버 실행 후 다음 엔드포인트에서 API 상태를 확인할 수 있습니다:

- 헬스체크: `GET /health`
- 기본 정보: `GET /`

상세한 API 문서는 개발 완료 후 추가될 예정입니다.

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 📞 지원

문제가 발생하거나 도움이 필요하면:

- GitHub Issues에 문제 보고
- 프로젝트 위키 확인
- 개발팀에 연락

---

**현재 버전**: 1.0.0 (MVP 개발 중)  
**마지막 업데이트**: 2025-06-27
