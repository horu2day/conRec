# Frontend Dockerfile
FROM node:20-alpine AS builder

# 빌드 시 환경변수 설정
ARG VITE_API_URL=http://host.docker.internal:3000/api
ARG VITE_SOCKET_URL=http://host.docker.internal:3000
ARG VITE_MAX_PARTICIPANTS=10

# 작업 디렉토리 설정
WORKDIR /app

# package.json과 package-lock.json 복사
COPY package*.json ./

# 의존성 설치
RUN npm ci

# 소스 코드 복사
COPY . .

# 환경변수 설정
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_MAX_PARTICIPANTS=$VITE_MAX_PARTICIPANTS

# React 앱 빌드
RUN npm run build

# Nginx를 사용한 프로덕션 이미지
FROM nginx:alpine

# Nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/nginx.conf

# 빌드된 파일 복사
COPY --from=builder /app/dist /usr/share/nginx/html

# 비특권 사용자로 실행
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

# 포트 노출
EXPOSE 80

# 헬스체크
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Nginx 실행
CMD ["nginx", "-g", "daemon off;"]
