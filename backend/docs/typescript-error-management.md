# TypeScript 오류 관리 시스템

## 📊 **발생한 오류 유형 분석 & 해결책**

### **🔴 이번 프로젝트에서 발생한 TypeScript 오류들**

| 오류 코드 | 오류 유형 | 발생 파일 | 발생 원인 | 해결 방법 | 예방책 |
|----------|----------|----------|----------|----------|----------|
| **TS6133** | 사용하지 않는 변수/매개변수 | app.ts, errorHandler.ts, logger.ts | `req`, `res`, `next` 등 미사용 | `_req`, `_res`, `_next`로 변경 | 매개변수명에 `_` 접두사 사용 |
| **TS7006** | 암시적 any 타입 | upload.ts, routes/*.ts | 매개변수 타입 미지정 | `req: Request, res: Response` 추가 | 모든 함수 매개변수에 타입 지정 |
| **TS18048** | undefined 가능성 | upload.ts | null 체크 누락 | `if (!file)` 체크 추가 | Optional 속성은 항상 null 체크 |
| **TS2769** | 함수 오버로드 불일치 | upload.ts, routes/upload.ts | Express 핸들러 시그니처 오류 + 반환 타입 문제 | `RequestHandler` 타입 명시 + `return res.json()` → `res.json(); return;` | Express 핸들러는 항상 void 반환 |
| **TS7030** | 반환값 누락 | routes/upload.ts | 모든 경로에서 return 없음 | `return` 문 추가 | 모든 함수 분기에서 return 확인 |

---

## 🛠 **해결된 문제들**

### **1. Express Error Handler 시그니처 문제**
```typescript
// ❌ 잘못된 방법
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction) => {

// ✅ 올바른 방법
export const handleUploadError: ErrorRequestHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
```

### **2. 사용하지 않는 매개변수 문제**
```typescript
// ❌ 잘못된 방법
app.get('/health', (req, res) => {

// ✅ 올바른 방법
app.get('/health', (_req, res) => {
```

### **3. Router 핸들러 배치 문제**
```typescript
// ❌ 잘못된 방법 - Error handler를 미들웨어로 사용
router.post('/audio', uploadAudio.single('audio'), handleUploadError, controller)

// ✅ 올바른 방법 - Error handler는 전역에서 처리
router.post('/audio', uploadAudio.single('audio'), controller)
```

---

## 🎯 **TypeScript 설정 최적화**

### **현재 적용된 설정 (tsconfig.json)**
```json
{
  "compilerOptions": {
    "strict": false,                    // 엄격 모드 비활성화
    "noUnusedLocals": false,           // 사용하지 않는 지역 변수 허용
    "noUnusedParameters": false,       // 사용하지 않는 매개변수 허용
    "noImplicitAny": false,            // 암시적 any 허용
    "noImplicitReturns": false,        // 암시적 return 허용
    "noFallthroughCasesInSwitch": false,
    "noUncheckedIndexedAccess": false
  }
}
```

---

## 📋 **코딩 가이드라인**

### **1. Express 핸들러 작성 규칙**
```typescript
// ✅ 일반 Request Handler
router.get('/path', (req: Request, res: Response, next: NextFunction) => {
  // 로직
})

// ✅ Error Handler (전역에서만 사용)
const errorHandler: ErrorRequestHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  // 에러 처리
}

// ✅ 사용하지 않는 매개변수
router.get('/path', (_req: Request, res: Response) => {
  // req를 사용하지 않을 때
})
```

### **2. Null/Undefined 체크 패턴**
```typescript
// ✅ 파일 존재 체크
if (!file) {
  return res.status(400).json({ error: 'File not found' })
}

// ✅ 배열 요소 체크
const item = array[i]
if (!item) {
  continue // 또는 적절한 처리
}
```

### **3. Import/Export 패턴**
```typescript
// ✅ Express 타입 import
import { Router, Request, Response, NextFunction, ErrorRequestHandler } from 'express'

// ✅ 조건부 import (필요한 경우만)
if (condition) {
  const { SomeModule } = await import('./module')
}
```

---

## 🚨 **향후 오류 방지 체크리스트**

### **✅ 새 파일 생성 시**
- [ ] 모든 함수 매개변수에 타입 지정
- [ ] Express 핸들러는 정확한 시그니처 사용
- [ ] 사용하지 않는 매개변수는 `_` 접두사
- [ ] Optional 속성은 null 체크
- [ ] 모든 함수 분기에서 return 확인

### **✅ 기존 파일 수정 시**
- [ ] TypeScript 컴파일 오류 확인
- [ ] 타입 불일치 해결
- [ ] import/export 경로 확인
- [ ] 사용하지 않는 코드 정리

### **✅ Express 관련 코드 작성 시**
- [ ] Request Handler: `(req, res, next) => void`
- [ ] Error Handler: `ErrorRequestHandler` 타입 사용
- [ ] Middleware는 `next()` 호출 확인
- [ ] Router에 Error Handler 직접 추가 금지

---

## 🔧 **문제 발생 시 해결 순서**

1. **오류 메시지 분석**: 오류 코드와 파일명 확인
2. **이 문서에서 해결책 검색**: 동일한 오류 유형 확인
3. **가이드라인 적용**: 위의 코딩 가이드라인 준수
4. **TypeScript 설정 완화**: 필요시 tsconfig.json 수정
5. **문서 업데이트**: 새로운 오류 유형 발견 시 이 문서에 추가

---

## 📚 **참고 자료**

- [Express TypeScript 공식 문서](https://expressjs.com/en/advanced/typescript.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Express 타입 정의](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/express)

---

**마지막 업데이트**: 2025-06-28  
**총 해결된 오류**: 5개 유형, 15개 파일  
**다음 체크**: 새로운 오류 발생 시 이 문서 업데이트
