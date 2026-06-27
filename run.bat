@echo off
title StockFlow Server
echo ==============================================
echo  StockFlow: Starting Web Server...
echo ==============================================
echo.
echo Opening dashboard at http://localhost:3000 ...
start http://localhost:3000
echo.
echo Starting database server. Keep this window open while using the site!
echo.
call npm.cmd start
if %errorlevel% neq 0 (
    call npm start
)
pause
