import os
import re
import sys
import time
import shutil
import subprocess
import urllib.request
import webbrowser

FRONTEND_ENV_PATH = os.path.join("frontend", ".env")
BACKUP_ENV_PATH = os.path.join("frontend", ".env.backup")
CLOUDFLARED_EXE = "cloudflared.exe"
CLOUDFLARED_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"

def download_cloudflared():
    global CLOUDFLARED_EXE
    if os.path.exists(CLOUDFLARED_EXE):
        return True
    
    # Check if cloudflared is in PATH
    if shutil.which("cloudflared"):
        CLOUDFLARED_EXE = "cloudflared"
        return True

    print("--> cloudflared.exe no encontrado localmente ni en el PATH.")
    print("--> Descargando cloudflared.exe desde los servidores oficiales de Cloudflare...")
    try:
        urllib.request.urlretrieve(CLOUDFLARED_URL, CLOUDFLARED_EXE)
        print("--> ¡Descarga completada con éxito!")
        return True
    except Exception as e:
        print(f"Error al descargar cloudflared: {e}")
        return False

def start_tunnel():
    print("--> Iniciando túnel de Cloudflare para el Frontend (puerto 5173)...")
    
    # Iniciar cloudflared redirigiendo a 127.0.0.1:5173
    process = subprocess.Popen(
        [CLOUDFLARED_EXE, "tunnel", "--url", "http://127.0.0.1:5173"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        bufsize=1
    )
    
    tunnel_url = None
    start_time = time.time()
    while True:
        if time.time() - start_time > 30: # Timeout de 30 segundos
            break
            
        line = process.stderr.readline()
        if not line:
            break
        
        # Buscar la URL del túnel temporal
        match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
        if match:
            tunnel_url = match.group(0)
            break
            
    if not tunnel_url:
        process.terminate()
        raise RuntimeError("No se pudo obtener la URL del túnel de Cloudflare en 30 segundos. Verifica tu conexión.")
        
    # Levantar un hilo de fondo para seguir consumiendo stderr y evitar bloqueo por buffer lleno
    import threading
    def consume_stderr(proc):
        try:
            for _ in proc.stderr:
                pass
        except Exception:
            pass
            
    t = threading.Thread(target=consume_stderr, args=(process,), daemon=True)
    t.start()
    
    return process, tunnel_url


def update_env(tunnel_url):
    if not os.path.exists(FRONTEND_ENV_PATH):
        print(f"Advertencia: No se encontró {FRONTEND_ENV_PATH}")
        return
        
    # Hacer backup del .env original si no existe
    if not os.path.exists(BACKUP_ENV_PATH):
        shutil.copyfile(FRONTEND_ENV_PATH, BACKUP_ENV_PATH)
        print("--> Copia de seguridad del archivo .env creada.")
    
    # Leer el .env original
    with open(FRONTEND_ENV_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()
        
    # Modificar VITE_API_BASE y VITE_PROXY_TARGET
    new_lines = []
    for line in lines:
        if line.strip().startswith("VITE_API_BASE="):
            new_lines.append(f"VITE_API_BASE={tunnel_url}\n")
        elif line.strip().startswith("VITE_PROXY_TARGET="):
            new_lines.append(f"VITE_PROXY_TARGET=http://127.0.0.1:8000\n")
        else:
            new_lines.append(line)
            
    with open(FRONTEND_ENV_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
        
    print(f"--> Archivo .env del frontend configurado preliminarmente con: {tunnel_url}")

def restore_env():
    if os.path.exists(BACKUP_ENV_PATH):
        shutil.copyfile(BACKUP_ENV_PATH, FRONTEND_ENV_PATH)
        os.remove(BACKUP_ENV_PATH)
        print("--> Archivo .env del frontend restaurado a su configuración original (localhost).")

def main():
    # 1. Limpieza inicial de puertos por seguridad
    print("--> Liberando puertos 5173 y 8000 de cualquier proceso previo...")
    os.system("for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %a >nul 2>&1")
    os.system("for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %a >nul 2>&1")
    
    if not download_cloudflared():
        print("ERROR: No se pudo preparar cloudflared. El script se cerrará.")
        sys.exit(1)
        
    tunnel_proc = None
    backend_proc = None
    frontend_proc = None
    
    try:
        # 2. Levantar el túnel PRIMERO para obtener la URL pública
        tunnel_proc, tunnel_url = start_tunnel()
        
        # 3. Escribir el .env ANTES de que Vite se inicie
        update_env(tunnel_url)
        
        # 4. Iniciar servidores locales (ya con el .env final escrito)
        print("--> Iniciando servidores de Backend y Frontend...")
        
        # Comando para iniciar backend
        backend_cmd = "cd backend && call venv\\Scripts\\activate.bat && python run.py"
        backend_proc = subprocess.Popen(
            f'start "Ventanas Geomecánicas 2.0 - Backend (FastAPI)" cmd /k "{backend_cmd}"',
            shell=True
        )
        
        # Comando para iniciar frontend
        frontend_cmd = "cd frontend && npm run dev"
        frontend_proc = subprocess.Popen(
            f'start "Ventanas Geomecánicas 2.0 - Frontend (React + Vite)" cmd /k "{frontend_cmd}"',
            shell=True
        )
        
        print("\n=======================================================================")
        print("         Mapeo Ventanas Geomecánicas 2.0 — COMPARTIDO CON CLOUDFLARE")
        print("=======================================================================")
        print(f"\n   URL PÚBLICA DEL PROYECTO:\n   {tunnel_url}\n")
        print("   Comparte este enlace para que cualquier cliente o evaluador acceda.")
        print("   Nota: Mantén esta ventana abierta para seguir compartiendo.")
        print("=======================================================================")
        
        # Esperar 3 segundos para que los servidores comiencen a escuchar y abrir navegador
        time.sleep(3)
        print("--> Abriendo el túnel en tu navegador predeterminado...")
        webbrowser.open(tunnel_url)
        
        print("\n--> Presiona ENTER para detener el túnel y restaurar todo al modo local...")
        input()
        
    except KeyboardInterrupt:
        print("\n--> Deteniendo túnel solicitado por el usuario...")
    except Exception as e:
        print(f"\nERROR: {e}")
    finally:
        # Limpieza de procesos y restauración de configuración
        if tunnel_proc:
            try:
                tunnel_proc.terminate()
                tunnel_proc.wait(timeout=2)
            except Exception:
                try:
                    tunnel_proc.kill()
                except Exception:
                    pass
            print("--> Túnel de Cloudflare cerrado.")
            
        restore_env()
        
        # Matar servidores locales y cloudflared para que no queden colgados
        print("--> Apagando servidores locales...")
        os.system("for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %a >nul 2>&1")
        os.system("for /f \"tokens=5\" %a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do taskkill /f /pid %a >nul 2>&1")
        os.system("taskkill /f /im cloudflared.exe >nul 2>&1")
        print("--> Todo limpio y restaurado con éxito.")

if __name__ == "__main__":
    main()
