@echo off
chcp 65001 >nul
title Don Peppini Contadore - Actualizar

echo.
echo ========================================================
echo     DON PEPPINI CONTADORE - ACTUALIZADOR
echo ========================================================
echo.

set "SCRIPT_DIR=%~dp0"

:: 1) Git pull (si tiene repo)

echo [1/3] Descargando actualizaciones...
cd /d "%SCRIPT_DIR%"
git pull origin main 2>nul
if %errorlevel% neq 0 (
    echo    No hay repositorio git. Esto es normal si descargo por ZIP.
    echo    Para recibir actualizaciones automaticas, pida que le compartan
    echo    el enlace de clonacion: git clone https://github.com/FelipeBossioZ/DonPeppiniContadore.git
)

:: 2) Backend

echo [2/3] Actualizando Backend...
cd /d "%SCRIPT_DIR%backend"

if not exist ".venv\Scripts\activate.bat" (
    echo X No se encontro el entorno virtual.
    echo    Ejecuta primero: INSTALAR_DonPeppini.bat
    pause
    exit /b 1
)

call ".venv\Scripts\activate.bat"
pip install -r requirements.txt
python manage.py migrate

echo    OK Backend actualizado

:: 3) Frontend

echo [3/3] Actualizando Frontend...
cd /d "%SCRIPT_DIR%frontend"
call npm install

echo    OK Frontend actualizado

echo.
echo ========================================================
echo     ACTUALIZACION COMPLETADA
echo ========================================================
echo.
echo Ejecuta INICIAR_DonPeppini.bat para usar el sistema.
echo.
pause
