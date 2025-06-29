@echo off
echo.
echo ========================================
echo   백엔드 서버 상태 확인
echo ========================================
echo.

echo [1] 현재 실행 중인 Node.js 프로세스 확인:
tasklist | findstr node.exe
echo.

echo [2] 3000 포트 사용 확인:
netstat -an | findstr :3000
echo.

echo [3] 백엔드 서버 헬스체크 시도:
echo URL: http://localhost:3000/health
echo.

curl -s http://localhost:3000/health 2>nul
if %ERRORLEVEL% == 0 (
    echo ✅ 백엔드 서버가 정상 실행 중입니다.
) else (
    echo ❌ 백엔드 서버에 연결할 수 없습니다.
    echo.
    echo 백엔드 서버를 실행하려면:
    echo cd D:\MYCLAUDE_PROJECT\conRec\backend
    echo node simple-server.js
)

echo.
pause
