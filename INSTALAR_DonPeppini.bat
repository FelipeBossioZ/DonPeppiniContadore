@echo off
chcp 65001 >nul
title Don Peppini Contadore - Instalador

echo.
echo ========================================================
echo     DON PEPPINI CONTADORE - INSTALADOR
echo     Sistema Contable NIIF para Pymes Colombia
echo ========================================================
echo.

set "SCRIPT_DIR=%~dp0"

:: Verificar Python
echo [1/5] Verificando Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X Python no esta instalado.
    echo    Descargalo de: https://www.python.org/downloads/
    echo    IMPORTANTE: Marca "Add Python to PATH" durante la instalacion
    pause
    exit /b 1
)
echo OK Python encontrado

:: Verificar Node.js
echo [2/5] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X Node.js no esta instalado.
    echo    Descargalo de: https://nodejs.org/
    pause
    exit /b 1
)
echo OK Node.js encontrado

:: Crear entorno virtual Backend
echo [3/5] Configurando Backend...
cd /d "%SCRIPT_DIR%backend"
if not exist ".venv" (
    echo    Creando entorno virtual...
    python -m venv .venv
)
call .venv\Scripts\activate.bat
echo    Instalando dependencias Python...
pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo X Error instalando dependencias Python
    pause
    exit /b 1
)
echo OK Backend configurado

:: Ejecutar migraciones
echo [4/5] Creando base de datos local...
python manage.py migrate
if %errorlevel% neq 0 (
    echo X Error en migraciones
    pause
    exit /b 1
)
echo OK Base de datos creada

cd /d "%SCRIPT_DIR%"

:: Instalar dependencias Frontend
echo [5/5] Configurando Frontend...
cd /d "%SCRIPT_DIR%frontend"
if not exist "node_modules" (
    echo    Instalando dependencias Node.js (puede tardar unos minutos)...
    call npm install
)
if %errorlevel% neq 0 (
    echo X Error instalando dependencias Node.js
    pause
    exit /b 1
)
echo OK Frontend configurado

cd /d "%SCRIPT_DIR%"

echo.
echo ========================================================
echo     INSTALACION COMPLETADA
echo ========================================================
echo.
echo Siguiente paso:
echo   - Ejecuta: INICIAR_DonPeppini.bat
echo.
pause