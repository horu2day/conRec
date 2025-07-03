@echo off
echo Starting conRec Backend Server in Production Mode...
echo.

REM 환경 변수 설정
set NODE_ENV=production

REM 프로덕션 환경 설정 파일 사용
if exist .env.production (
    echo Using production environment configuration
    copy .env.production .env
) else (
    echo Warning: .env.production file not found, using default .env
)

REM 빌드 확인
if not exist dist (
    echo Building project...
    npm run build
    if errorlevel 1 (
        echo Build failed!
        pause
        exit /b 1
    )
)

REM 서버 시작
echo Starting server...
echo.
npm run start:prod

pause
