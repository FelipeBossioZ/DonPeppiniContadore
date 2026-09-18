@echo off
chcp 65001 >nul
title Crear Accesos Directos - Don Peppini

echo.
echo Creando accesos directos en el escritorio...
echo.

set "SCRIPT_DIR=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $desk = [Environment]::GetFolderPath('Desktop'); $s = $ws.CreateShortcut($desk + '\Don Peppini Contadore.lnk'); $s.TargetPath = '%SCRIPT_DIR%INICIAR_DonPeppini.bat'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.IconLocation = '%SCRIPT_DIR%donpeppini.ico'; $s.Description = 'Abrir sistema (trae la base desde OneDrive)'; $s.Save(); $c = $ws.CreateShortcut($desk + '\Don Peppini CERRAR.lnk'); $c.TargetPath = '%SCRIPT_DIR%CERRAR_DonPeppini.bat'; $c.WorkingDirectory = '%SCRIPT_DIR%'; $c.IconLocation = '%SCRIPT_DIR%donpeppini.ico'; $c.Description = 'Cerrar sistema y guardar la base en OneDrive'; $c.Save(); Write-Host 'OK Accesos directos creados: Don Peppini Contadore / Don Peppini CERRAR'"

echo.
pause
