@echo off
echo ==========================================
echo      Starting ValuationAI App
echo ==========================================
echo.
echo Step 1: Starting Backend Server...
start "ValuationAI Backend" cmd /k "cd /d %~dp0 && uvicorn backend.main:app --reload"
echo Backend started.
echo.
echo Step 2: Starting Frontend Server...
cd frontend
start "ValuationAI Frontend" cmd /k "npm run dev"
echo Frontend started.
echo.
echo ==========================================
echo IMPORTANT:
echo Please wait a few seconds for the servers to start.
echo The app should open automatically in your browser.
echo If it doesn't, open this URL manually: http://localhost:5173
echo.
echo DO NOT open index.html directly from the folder.
echo ==========================================
pause
