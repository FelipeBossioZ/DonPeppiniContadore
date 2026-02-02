@echo off
chcp 65001 >nul
title Crear Acceso Directo - Don Peppini

echo.
echo Creando acceso directo en el escritorio...
echo.

set "SCRIPT_DIR=%~dp0"
set "TARGET=%SCRIPT_DIR%INICIAR_DonPeppini.bat"

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Don Peppini Contadore.lnk'); $s.TargetPath = '%TARGET%'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.Description = 'Sistema Contable NIIF para Pymes'; $s.Save(); Write-Host 'OK Acceso directo creado en el escritorio'"

echo.
pause
