@echo off
title MMS v3 - نظام ادارة الاجهزة الطبية
cd /d "%~dp0"
echo.
echo ================================================
echo    MMS v3 - نظام ادارة الاجهزة الطبية
echo ================================================
echo.

REM تحقق من وجود bun
where bun >nul 2>&1
if %errorlevel% == 0 (
    echo [1/2] تثبيت الحزم بـ bun...
    bun install
    echo.
    echo [2/2] تشغيل السيرفر...
    echo الرابط: http://localhost:3000
    echo.
    bun dev
) else (
    echo bun غير موجود - جاري التثبيت...
    powershell -c "irm bun.sh/install.ps1 | iex"
    echo.
    echo [1/2] تثبيت الحزم...
    bun install
    echo.
    echo [2/2] تشغيل السيرفر...
    echo الرابط: http://localhost:3000
    echo.
    bun dev
)
pause
