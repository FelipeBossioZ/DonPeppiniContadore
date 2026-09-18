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
echo    OK Python encontrado

:: Verificar Node.js
echo [2/5] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo X Node.js no esta instalado.
    echo    Descargalo de: https://nodejs.org/
    pause
    exit /b 1
)
echo    OK Node.js encontrado

:: Crear entorno virtual Backend
echo [3/5] Configurando Backend...
cd /d "%SCRIPT_DIR%backend"
if not exist ".venv" (
    echo    Creando entorno virtual...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo X Error al crear entorno virtual
        pause
        exit /b 1
    )
)
call ".venv\Scripts\activate.bat"
echo    Instalando dependencias Python (puede tardar)...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo X Error instalando dependencias Python
    pause
    exit /b 1
)
echo    OK Backend configurado

:: Configurar boveda y traer la base de datos compartida ANTES de migrar
echo [4/5] Configurando boveda de datos (OneDrive)...
cd /d "%SCRIPT_DIR%"
if exist "CONFIG_LOCAL.txt" goto boveda_ok
echo    Ruta de la carpeta compartida de OneDrive donde vive la base de datos.
set "BOVEDA="
set /p BOVEDA="   Ruta de la boveda (ENTER = Z:\OneDrive\OFICINA\FELIPE\Oficina Felipe\2_CONTABILIDAD\DataBase): "
if "%BOVEDA%"=="" set "BOVEDA=Z:\OneDrive\OFICINA\FELIPE\Oficina Felipe\2_CONTABILIDAD\DataBase"
>"CONFIG_LOCAL.txt" echo BOVEDA=%BOVEDA%
:boveda_ok
echo    Boveda configurada:
type "CONFIG_LOCAL.txt"
if not exist "backend\.env" (
    >"backend\.env" echo DB_PATH=%SCRIPT_DIR%backend\db.sqlite3
    echo    OK backend\.env creado con la ruta local de esta PC
)
echo    Trayendo la base de datos mas reciente desde la boveda...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%sync_db.ps1" -Modo pull
if %errorlevel% equ 2 (
    echo X No se pudo traer la base de datos desde la boveda.
    pause
    exit /b 1
)
echo.
cd /d "%SCRIPT_DIR%backend"
echo    Aplicando migraciones...
python manage.py migrate
if %errorlevel% neq 0 (
    echo X Error en migraciones
    pause
    exit /b 1
)
echo    OK Base de datos lista

cd /d "%SCRIPT_DIR%"

:: Instalar dependencias Frontend
echo [5/5] Configurando Frontend...
cd /d "%SCRIPT_DIR%frontend"
echo    Instalando dependencias Node.js (puede tardar)...
call npm install
if %errorlevel% neq 0 (
    echo X Error instalando dependencias Node.js
    pause
    exit /b 1
)
echo    OK Frontend configurado

cd /d "%SCRIPT_DIR%"

echo.
echo ========================================================
echo     INSTALACION COMPLETADA
echo ========================================================
echo.
echo Siguiente paso:
echo   1. Ejecuta: INICIAR_DonPeppini.bat
echo   2. Crea tu usuario: cd backend ^& .venv\Scripts\activate ^& python manage.py createsuperuser
echo   3. Configura roles:  python manage.py setup_roles
echo   4. Carga el PUC:     python manage.py cargar_puc
echo.
pause
