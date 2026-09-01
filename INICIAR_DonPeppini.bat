@echo off
chcp 65001 >nul
title Don Peppini Contadore

echo.
echo ========================================================
echo     Don Peppini Contadore - Iniciando sistema...
echo ========================================================
echo.

set "SCRIPT_DIR=%~dp0"

if not exist "%SCRIPT_DIR%backend\.venv\Scripts\activate.bat" (
    echo X No se encontro el entorno virtual.
    echo    Ejecuta primero: INSTALAR_DonPeppini.bat
    pause
    exit /b 1
)

:: Iniciar Backend en una nueva ventana
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
