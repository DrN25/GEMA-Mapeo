@echo off
title Ventanas Geomecánicas 2.0 - Compartir con el Mundo (Cloudflare Tunnels)
color 05

echo =======================================================================
echo         VENTANAS GEOMECÁNICAS 2.0 - COMPARTIR PROYECTO EN VIVO
echo =======================================================================
echo.
echo Este script creara un enlace publico temporal seguro usando Cloudflare
echo para que puedas mostrar la aplicacion en tiempo real.
echo.
echo Este script realizara las siguientes tareas de forma automatica:
echo   1. Verificara las dependencias del sistema (Node.js y Python).
echo   2. Instalara las dependencias si no existen (venv, npm install).
echo   3. Descargara e iniciara el tunel seguro de Cloudflare.
echo   4. Iniciara el Backend (FastAPI) y el Frontend (React + Vite).
echo   5. Abrira tu navegador de forma automatica con el enlace listo.
echo.
echo Al cerrar esta ventana o presionar ENTER, todo se apagara de forma
echo limpia y volvera a la normalidad local (localhost).
echo =======================================================================
echo.

:: 1. Verificar dependencias del sistema
echo [1/3] Verificando instalacion de herramientas en el sistema...
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

:: 2. Configurar backend y frontend si no tienen dependencias
echo [2/3] Comprobando dependencias de servidores...
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

if not exist node_modules\.bin\vite.cmd call npm.cmd install --include=dev

cd ..
echo OK: Dependencias instaladas y listas.
echo.

:: 3. Iniciar script principal de Cloudflare y automatizacion
echo [3/3] Iniciando orquestador de tunel y servidores...
if exist backend\venv\Scripts\python.exe (
    backend\venv\Scripts\python.exe compartir.py
) else (
    python compartir.py
)

exit
