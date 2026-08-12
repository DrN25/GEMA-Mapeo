@echo off
title Ventanas Geomecánicas 2.0 - Servidor Público (Cloudflare Tunnel)
color 0D

echo =======================================================================
echo         VENTANAS GEOMECANICAS 2.0 - MODO SERVIDOR PUBLICO
echo =======================================================================
echo.
echo Este script funciona en CUALQUIER computadora con internet:
echo   - Descarga cloudflared.exe si no existe (no instala nada)
echo   - Levanta Backend + Frontend
echo   - Abre el tunel hacia https://mapeogema.dpdns.org
echo   - Al presionar ENTER todo se apaga (el tunel muere con el script)
echo.
echo Requisitos: Python y Node.js en el PATH, y que el hostname del
echo tunel (mapeogema.dpdns.org) este configurado en Cloudflare con el
echo CNAME apuntando al tunel.
echo =======================================================================
echo.

:: ============================================================
:: CONFIGURACION - REEMPLAZA con TU token completo de Cloudflare
:: ============================================================
set "CF_TOKEN=eyJhIjoiMjg0NmZmYmYxNDcxZmVkM2E3ODU1NGEzYjlhMTMzZjAiLCJ0IjoiM2I3ZTMzYmMtYzI4MC00YWYyLWE1ZTctNzIyYjFlOWRiNzU2IiwicyI6Ik9EZ3hOak5sT0RBdFlqaGpOeTAwWkRZM0xXSmlNVFF0TnpsaFpERmpZVFUyWTJWbSJ9"
set "URL_PUBLICA=https://mapeogema.dpdns.org"

:: 1. Verificar dependencias del sistema
echo [1/4] Verificando instalacion de herramientas en el sistema...
where python >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Python no esta instalado o no fue agregado al PATH.
    pause
    exit /b
)
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo ERROR: Node.js no esta instalado o no fue agregado al PATH.
    pause
    exit /b
)
echo OK: Herramientas listas.
echo.

:: 2. Descargar cloudflared si no existe
echo [2/4] Verificando cloudflared.exe...
if not exist cloudflared.exe (
    echo Descargando cloudflared desde Cloudflare...
    curl -L -o cloudflared.exe https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
    if not exist cloudflared.exe (
        color 0C
        echo ERROR: No se pudo descargar cloudflared.exe. Verifica la conexion a internet.
        pause
        exit /b
    )
)
echo OK: cloudflared listo.
echo.

:: 3. Configurar backend y frontend si no tienen dependencias
echo [3/4] Comprobando dependencias de servidores...
cd backend
if not exist venv (
    echo Creando entorno virtual de Python [venv]...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo Instalando dependencias de Python (requirements.txt)...
pip install -r requirements.txt >nul 2>&1
cd ..

cd frontend
if not exist node_modules (
    echo Instalando modulos de Node.js [esto puede tardar]...
    call npm.cmd install >nul 2>&1
)
cd ..
echo OK: Dependencias instaladas y listas.
echo.

:: Restaurar .env local si quedara un respaldo de una sesion anterior
if exist frontend\.env.backup (
    copy /y frontend\.env.backup frontend\.env >nul
    del /f /q frontend\.env.backup >nul
)

:: 4. Liberar puertos e iniciar todo
echo [4/4] Liberando puertos e iniciando servidores...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5174 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8001 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
taskkill /f /im cloudflared.exe >nul 2>&1

:: Iniciar Backend
start "Ventanas 2.0 - Backend (FastAPI)" cmd /k "cd backend && call venv\Scripts\activate.bat && python run.py"

:: Iniciar Frontend
start "Ventanas 2.0 - Frontend (React + Vite)" cmd /k "cd frontend && npm run dev"

:: Iniciar Tunel de Cloudflare (en primer plano, muere con el script)
echo Iniciando tunel de Cloudflare...
start "Ventanas 2.0 - Tunel Cloudflare" cmd /k "cloudflared.exe tunnel run --token %CF_TOKEN%"

echo.
echo =======================================================================
echo ¡SERVIDOR LEVANTADO!
echo.
echo URL PUBLICA: %URL_PUBLICA%
echo.
echo Espera unos segundos a que el tunel se conecte, luego abre la URL.
echo El tunel muere cuando cierres este script.
echo =======================================================================
echo.

timeout /t 8 /nobreak >nul 2>&1
start %URL_PUBLICA%

pause >nul

:: Apagar todo al presionar ENTER
echo Apagando servidores y tunel...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5174 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8001 ^| findstr LISTENING') do taskkill /f /pid %%a >nul 2>&1
taskkill /f /im cloudflared.exe >nul 2>&1

echo Todo apagado. ¡Hasta luego!
