@echo off
echo Finding available port...

REM 사용 가능한 포트 찾기
for /L %%i in (3000,1,3020) do (
    netstat -an | findstr ":%%i " >nul
    if errorlevel 1 (
        echo Found available port: %%i
        set PORT=%%i
        goto :start_server
    )
)

echo No available port found between 3000-3020
pause
exit /b 1

:start_server
echo Starting server on port %PORT%
set NODE_ENV=development
npm run start

pause
