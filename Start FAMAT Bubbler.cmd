@echo off
rem Double-click to open FAMAT Bubbler (Quick print).
rem A minimized "FAMAT Bubbler server" window runs while you work; close it when done.
cd /d "%~dp0"
start "FAMAT Bubbler server" /min node scripts\serve.mjs
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/"
