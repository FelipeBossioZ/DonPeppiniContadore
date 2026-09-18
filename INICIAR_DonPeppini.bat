@echo off
chcp 65001 >nul
title Don Peppini Contadore

echo.
echo ========================================================
echo     Don Peppini Contadore - Iniciando sistema...
echo ========================================================
echo.

set "SCRIPT_DIR=%~dp0"

:: Sincronizar base de datos con la boveda (OneDrive) antes de abrir
echo Sincronizando base de datos con la boveda...
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%sync_db.ps1" -Modo pull
if %errorlevel% equ 2 (
    echo X No se pudo sincronizar la base de datos.
    echo   Revisa tu conexion/internet o CONFIG_LOCAL.txt e intenta de nuevo.
    pause
    exit /b 1
)
echo.

if not exist "%SCRIPT_DIR%backend\.venv\Scripts\activate.bat" (
    echo X No se encontro el entorno virtual.
    echo    Ejecuta primero: INSTALAR_DonPeppini.bat
    pause
    exit /b 1
)

:: Aplicar actualizaciones de esquema si el codigo trae migraciones nuevascd /d "%SCRIPT_DIR%backend"call .venv\Scripts\activate.batpython manage.py migrate >nul 2>&1if %errorlevel% neq 0 (    echo X Error aplicando actualizaciones de base de datos.    pause    exit /b 1)cd /d "%SCRIPT_DIR%":: Iniciar Backend en una nueva ventana
echo Iniciando Backend (Django)...
start "Don Peppini - Backend" cmd /k "cd /d %SCRIPT_DIR%backend & call .venv\Scripts\activate.bat & python manage.py runserver"

:: Esperar 3 segundos
timeout /t 3 /nobreak >nul

:: Iniciar Frontend en una nueva ventana
echo Iniciando Frontend (React)...
start "Don Peppini - Frontend" cmd /k "cd /d %SCRIPT_DIR%frontend & npm run dev"

:: Esperar 5 segundos
timeout /t 5 /nobreak >nul

:: Abrir el navegador
echo Abriendo navegador...
start http://localhost:5173

echo.
echo ========================================================
echo     DON PEPPINI CONTADORE INICIADO
echo --------------------------------------------------------
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo   Admin:    http://localhost:8000/admin
echo --------------------------------------------------------
echo   Para cerrar: Cierra las ventanas Backend y Frontend
echo ========================================================
echo.
pause
