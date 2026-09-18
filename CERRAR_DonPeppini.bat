@echo off
chcp 65001 >nul
title Don Peppini Contadore - Cerrar y guardar

set "SCRIPT_DIR=%~dp0"

echo.
echo ========================================================
echo   DON PEPPINI CONTADORE - Cierre seguro
echo ========================================================
echo.
echo  Cerrando el sistema y guardando la base de datos
echo  en la boveda de OneDrive...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%sync_db.ps1" -Modo push
echo.
pause
