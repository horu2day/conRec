@echo off
echo.
echo ========================================
echo   conRec 백엔드 서버 실행 스크립트
echo ========================================
echo.

cd /d "D:\MYCLAUDE_PROJECT\conRec\backend"

echo [1/3] 현재 디렉토리 확인...
cd

echo.
echo [2/3] MongoDB 실행 확인...
tasklist | findstr mongod >nul
if %ERRORLEVEL% == 0 (
    echo ✅ MongoDB가 실행 중입니다.
) else (
    echo ❌ MongoDB가 실행되지 않았습니다.
    echo MongoDB를 먼저 실행해주세요: mongod
    pause
    exit /b 1
)

echo.
echo [3/3] 백엔드 서버 실행 중...
echo 서버 URL: http://localhost:3000
echo 헬스체크: http://localhost:3000/health
echo.
echo 서버를 중지하려면 Ctrl+C를 눌러주세요.
echo.

node simple-server.js

pause
