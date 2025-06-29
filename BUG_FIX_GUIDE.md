# 🚨 Phase 6 테스트 중 발견된 버그 해결 가이드

## 📋 **현재 상황 요약**
- ✅ **백엔드 코드**: 완성됨 (TypeScript 기반)
- ✅ **프론트엔드 코드**: 완성됨 (React + TypeScript)
- ❌ **실행 환경**: TypeScript path mapping 문제로 서버 실행 불가
- ❌ **참여자 입장**: "존재하지 않는 회의방입니다" 버그 발생

---

## 🔧 **즉시 해결 방법 (3가지 옵션)**

### **옵션 1: 간단한 JavaScript 서버 사용 (권장)**

1. **백엔드 디렉토리로 이동**
```bash
cd D:\MYCLAUDE_PROJECT\conRec\backend
```

2. **simple-server.js 실행**
```bash
node simple-server.js
```

3. **프론트엔드 실행 (새 터미널)**
```bash
cd D:\MYCLAUDE_PROJECT\conRec\frontend
npm run dev
```

### **옵션 2: TypeScript 경로 수정**

**백엔드 파일들의 import 경로를 상대 경로로 변경**
- `@/config` → `./config/index`
- `@/utils/logger` → `./utils/logger`
- `@/services/socketService` → `./services/socketService`

**수정 후 컴파일 및 실행**
```bash
cd D:\MYCLAUDE_PROJECT\conRec\backend
npm run build
npm start
```

### **옵션 3: module-alias 설정**

**package.json에서 _moduleAliases 확인**
```json
{
  "_moduleAliases": {
    "@": "./dist"
  }
}
```

**dist/server.js 첫 줄에 추가**
```javascript
require('module-alias/register');
```

---

## 🐛 **참여자 입장 버그 수정**

### **문제 원인**
Socket.io와 HTTP API 간의 데이터 동기화 문제

### **해결책**
`frontend/src/pages/JoinMeetingPage.tsx`에서 이미 수정됨:
- 1단계: HTTP API로 방 유효성 확인
- 2단계: Socket.io로 실제 참여

### **추가 확인 사항**
1. **백엔드 서버가 정상 실행되고 있는지 확인**
   - `http://localhost:3000/health` 접속
   - `{"status":"ok"}` 응답 확인

2. **프론트엔드 환경변수 확인**
   ```bash
   # frontend/.env
   VITE_API_URL=http://localhost:3000/api
   VITE_SOCKET_URL=http://localhost:3000
   ```

3. **브라우저 콘솔 에러 확인**
   - F12 → Console 탭
   - 네트워크 오류나 CORS 문제 확인

---

## 🧪 **테스트 시나리오**

### **1단계: 환경 확인**
```bash
# MongoDB 실행 확인
tasklist | findstr mongod

# 포트 사용 확인
netstat -an | findstr 3000
netstat -an | findstr 5173
```

### **2단계: 서버 실행**
```bash
# 백엔드 서버 실행
cd D:\MYCLAUDE_PROJECT\conRec\backend
node simple-server.js

# 프론트엔드 서버 실행 (새 터미널)
cd D:\MYCLAUDE_PROJECT\conRec\frontend
npm run dev
```

### **3단계: 기능 테스트**
1. **홈페이지 접속**: `http://localhost:5173`
2. **회의방 생성**: "회의방 생성" → 이름 입력 → 생성
3. **참여자 입장**: 새 브라우저에서 회의 링크 접속
4. **녹음 제어**: 호스트에서 녹음 시작/중지 테스트

---

## 💡 **주요 포인트**

### **성공 지표**
- ✅ 백엔드: `http://localhost:3000/health` 정상 응답
- ✅ 프론트엔드: `http://localhost:5173` 정상 로드
- ✅ 회의방 생성: 성공 메시지 + 회의방 페이지 이동
- ✅ 참여자 입장: 실시간 참여자 목록 업데이트
- ✅ 녹음 제어: 모든 참여자 동시 녹음 시작/중지

### **실패 시 확인사항**
1. **포트 충돌**: 3000, 5173 포트 사용 중인지 확인
2. **CORS 오류**: 환경변수 설정 확인
3. **MongoDB 연결**: MongoDB 서비스 실행 상태 확인
4. **의존성 설치**: `npm install` 재실행

---

## 🚀 **다음 단계**

버그 해결 후:
1. **Phase 6 테스트 완료**
2. **Phase 7: 파일 업로드 테스트**
3. **Phase 8: 전체 시스템 통합 테스트**
4. **Phase 9: 성능 최적화**
5. **Phase 10: 배포 준비**

---

**작성일**: 2025-06-29  
**상태**: 🔄 **진행 중** - 서버 실행 환경 문제 해결 필요  
**우선순위**: 🚨 **긴급** - MVP 완성을 위한 핵심 문제
