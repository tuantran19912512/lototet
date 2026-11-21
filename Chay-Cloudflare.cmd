@echo off
chcp 65001 >nul
title XO LO TO TET - MAY CHU + CLOUDFLARE TUNNEL
cd /d "%~dp0"
echo.
echo  ============================================================
echo    XO LO TO TET - CHAY QUA INTERNET (CLOUDFLARE TUNNEL)
echo  ============================================================
echo.

where cloudflared >nul 2>&1
if errorlevel 1 (
  echo  CHUA CO cloudflared. Cai bang 1 trong cac cach:
  echo    - winget install --id Cloudflare.cloudflared
  echo    - hoac tai https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo  Dang cai dat dependencies lan dau...
  call npm install
)

echo  Dang khoi dong cloudflared quick tunnel...
echo  (URL se hien o cac dong 'https://xxxx.trycloudflare.com' ben duoi)
echo.

REM Doc URL tu cloudflared (dong co 'trycloudflare.com'), roi set PUBLIC_URL cho server
for /f "tokens=*" %%a in ('cloudflared tunnel --url http://localhost:3000 2^>^&1 ^| findstr /i "trycloudflare.com"') do (
  for %%u in (%%a) do (
    echo %%u | findstr /i "https://" >nul
    if not errorlevel 1 (
      set "PUBLIC_URL=%%u"
      goto :found
    )
  )
)
:found
if not defined PUBLIC_URL (
  echo  Khong doc duoc URL tu cloudflared. Kiem tra lai ket noi mang.
  pause
  exit /b 1
)

echo.
echo  >>> PUBLIC URL: %PUBLIC_URL%
echo  >>> Trang quan ly may nay: http://localhost:3000
echo  >>> Nguoi choi quet QR tren man hinh chinh (QR da doi thanh public URL).
echo  >>> LUU Y: URL thay doi moi lan chay! Gui URL moi cho nguoi choi.
echo.
start "May chu Loto" cmd /c "set PUBLIC_URL=%PUBLIC_URL% && npm start"
echo  May chuan da chay (cua so rieng). Nhan Ctrl+C de dung tunnel.
pause
