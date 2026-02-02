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
echo [1/6] Verificando Python...
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
echo [2/6] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X Node.js no esta instalado.
    echo    Descargalo de: https://nodejs.org/
    pause
    exit /b 1
)
echo OK Node.js encontrado

:: Crear entorno virtual Backend
echo [3/6] Configurando Backend...
cd /d "%SCRIPT_DIR%backend"
if not exist "venv" (
    echo    Creando entorno virtual...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo    Instalando dependencias Python...
pip install -r requirements.txt --quiet
if %errorlevel% neq 0 (
    echo X Error instalando dependencias Python
    pause
    exit /b 1
)
echo OK Backend configurado

:: Verificar archivo .env
echo [4/6] Verificando configuracion...
if not exist ".env" (
    echo X Falta el archivo .env en la carpeta backend
    echo    Crea el archivo backend\.env con el contenido:
    echo    DATABASE_URL=postgresql://postgres:TU_PASSWORD@db.xxxxx.supabase.co:5432/postgres
    pause
    exit /b 1
)
echo OK Archivo .env encontrado

:: Ejecutar migraciones
echo [5/6] Verificando base de datos...
python manage.py migrate
echo OK Base de datos lista

cd /d "%SCRIPT_DIR%"

:: Instalar dependencias Frontend
echo [6/6] Configurando Frontend...
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
echo Para iniciar Don Peppini Contadore:
echo   - Ejecuta: INICIAR_DonPeppini.bat
echo.
pause
