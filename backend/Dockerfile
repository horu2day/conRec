# Backend Dockerfile - 회의실 음성 녹음 시스템

# Base image - Node.js 20 LTS Alpine (가벼운 Linux 배포판)
FROM node:20-alpine

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 매니저 설정
RUN npm config set registry https://registry.npmjs.org/

# 시스템 의존성 설치 (native 모듈을 위한 빌드 도구)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

# Package.json과 package-lock.json 복사 (의존성 캐싱 최적화)
COPY package*.json .

# 의존성 설치 (production + devDependencies)
RUN npm ci --include=dev 

# 의존성 설치
# RUN npm ci

# 소스 코드 복사
COPY . .

# 프로덕션 빌드 실행
RUN npm run build

# 업로드 디렉토리 생성
RUN mkdir -p uploads

# 포트 노출 (3000번 포트)
EXPOSE 3000

# 헬스체크 설정
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# 사용자 권한 설정 (보안을 위해 root가 아닌 사용자로 실행)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

# 개발 환경에서는 docker-server.js 실행
# CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# 프로덕션 환경에서는 빌드된 파일 실행
CMD ["npm", "start"]