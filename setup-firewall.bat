@echo off
:: Run this ONCE as Administrator to allow iPhone/Tailscale access.
:: Right-click → "Run as administrator"

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║      Robbins App - Firewall Setup (once)     ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: Check for admin rights
net session >nul 2>&1
if errorlevel 1 (
    echo  ERROR: This script must be run as Administrator.
    echo.
    echo  Right-click on setup-firewall.bat and choose
    echo  "Run as administrator", then try again.
    echo.
    pause
    exit /b 1
)

:: Remove old rule if exists
netsh advfirewall firewall delete rule name="Robbins App Port 3000" >nul 2>&1

:: Add new rule
netsh advfirewall firewall add rule ^
    name="Robbins App Port 3000" ^
    dir=in ^
    action=allow ^
    protocol=TCP ^
    localport=3000 ^
    profile=any ^
    description="Robbins App dev server - allows access from iPhone via Tailscale"

if errorlevel 1 (
    echo.
    echo  FAILED to add firewall rule.
) else (
    echo.
    echo  SUCCESS! Firewall rule added.
    echo  You can now access the app from your iPhone via Tailscale.
    echo.
    echo  Run run.bat to start the app.
)

echo.
pause
