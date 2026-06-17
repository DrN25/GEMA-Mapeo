import os
import re
import sys
import time
import shutil
import subprocess
import urllib.request
import webbrowser
import threading

FRONTEND_ENV_PATH = os.path.join("frontend", ".env")
BACKUP_ENV_PATH = os.path.join("frontend", ".env.backup")
CLOUDFLARED_EXE = "cloudflared.exe"
CLOUDFLARED_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"


def kill_process_on_port(port: int):
    """Mata cualquier proceso que esté usando el puerto"""
    print(f"--> Liberando puerto {port}...")
    try:
        subprocess.call(
            f'for /f "tokens=5" %a in (\'netstat -aon ^| findstr :{port} ^| findstr LISTENING\') do taskkill /f /pid %a >nul 2>&1',
            shell=True
        )
    except:
        pass


def download_cloudflared():
    global CLOUDFLARED_EXE
    if os.path.exists(CLOUDFLARED_EXE):
        return True
    if shutil.which("cloudflared"):
        CLOUDFLARED_EXE = "cloudflared"
        return True

    print("--> cloudflared.exe no encontrado. Descargando desde Cloudflare...")
    try:
        urllib.request.urlretrieve(CLOUDFLARED_URL, CLOUDFLARED_EXE)
        print("--> ¡cloudflared descargado correctamente!")
        return True
    except Exception as e:
        print(f"Error al descargar cloudflared: {e}")
        return False


def consume_output(pipe, prefix=""):
    """Consume salida para evitar que se llene el buffer"""
    try:
        for line in pipe:
            if line.strip():
                if "error" in line.lower() or "failed" in line.lower():
                    print(f"{prefix} [ERROR] {line.strip()}")
                else:
                    print(f"{prefix} {line.strip()}")
    except:
        pass


def start_tunnel():
    print("--> Iniciando túnel de Cloudflare para Frontend (puerto 5174)...")
    
    cmd = [
        CLOUDFLARED_EXE,
        "tunnel",
        "--protocol", "http2",           # Más estable en la mayoría de casos
        "--url", "http://127.0.0.1:5174",
        "--no-autoupdate",
        "--edge-ip-version", "4"         # Fuerza IPv4 (reduce problemas mixtos)
    ]

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        universal_newlines=True
    )

    tunnel_url = None
    start_time = time.time()

    while time.time() - start_time < 50:   # Timeout más generoso
        line = process.stderr.readline()
        if not line:
            time.sleep(0.3)
            continue

        print(f"[cloudflared] {line.strip()}")

        match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
        if match:
            tunnel_url = match.group(0)
            print(f"\n--> ¡Túnel creado exitosamente!\n    URL: {tunnel_url}")
            break

    if not tunnel_url:
        process.terminate()
        raise RuntimeError("No se pudo obtener la URL del túnel en 50 segundos. Verifica tu conexión a internet.")

    # Iniciar hilos para consumir salida y evitar bloqueos
    threading.Thread(target=consume_output, args=(process.stdout, "[cloudflared]"), daemon=True).start()
    threading.Thread(target=consume_output, args=(process.stderr, "[cloudflared]"), daemon=True).start()

    # Tiempo crítico de estabilización
    print("--> Esperando estabilización del túnel (10 segundos)...")
    time.sleep(10)

    return process, tunnel_url


def update_env(tunnel_url: str):
    if not os.path.exists(FRONTEND_ENV_PATH):
        print(f"⚠️  No se encontró {FRONTEND_ENV_PATH}")
        return

    if not os.path.exists(BACKUP_ENV_PATH):
        shutil.copyfile(FRONTEND_ENV_PATH, BACKUP_ENV_PATH)
        print("--> Backup de .env creado.")

    with open(FRONTEND_ENV_PATH, "r", encoding="utf-8") as f:
        lines = f.readlines()

    new_lines = []
    for line in lines:
        if line.strip().startswith("VITE_API_BASE="):
            new_lines.append(f"VITE_API_BASE={tunnel_url}\n")
        elif line.strip().startswith("VITE_PROXY_TARGET="):
            new_lines.append("VITE_PROXY_TARGET=http://127.0.0.1:8001\n")
        else:
            new_lines.append(line)

    with open(FRONTEND_ENV_PATH, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    print(f"--> .env actualizado con URL pública: {tunnel_url}")


def restore_env():
    if os.path.exists(BACKUP_ENV_PATH):
        shutil.copyfile(BACKUP_ENV_PATH, FRONTEND_ENV_PATH)
        os.remove(BACKUP_ENV_PATH)
        print("--> .env restaurado a configuración local.")


def main():
    print("=" * 80)
    print("     VENTANAS GEOMECÁNICAS 2.0 - Compartir con Cloudflare Tunnel")
    print("=" * 80)

    # Limpieza inicial agresiva
    kill_process_on_port(5174)
    kill_process_on_port(8001)
    subprocess.call("taskkill /f /im cloudflared.exe >nul 2>&1", shell=True)

    if not download_cloudflared():
        print("❌ No se pudo preparar cloudflared.")
        sys.exit(1)

    tunnel_proc = backend_proc = frontend_proc = None

    try:
        # 1. Iniciar túnel primero
        tunnel_proc, tunnel_url = start_tunnel()

        # 2. Actualizar .env
        update_env(tunnel_url)

        # 3. Iniciar Backend
        print("--> Iniciando Backend (FastAPI)...")
        backend_cmd = 'cd backend && call venv\\Scripts\\activate.bat && python run.py'
        backend_proc = subprocess.Popen(
            f'start "Backend - Ventanas Geomecánicas" cmd /k "{backend_cmd}"',
            shell=True
        )

        # 4. Iniciar Frontend
        print("--> Iniciando Frontend (Vite)...")
        frontend_cmd = 'cd frontend && npm run dev'
        frontend_proc = subprocess.Popen(
            f'start "Frontend - Ventanas Geomecánicas" cmd /k "{frontend_cmd}"',
            shell=True
        )

        # Tiempo para que los servidores levanten
        print("--> Esperando que los servidores inicien (8 segundos)...")
        time.sleep(8)

        print("\n" + "=" * 80)
        print("✅ ¡PROYECTO COMPARTIDO EXITOSAMENTE!")
        print("=" * 80)
        print(f"\n🔗 URL PÚBLICA:\n   {tunnel_url}\n")
        print("   Comparte este enlace. Mantén esta ventana abierta.")
        print("=" * 80)

        webbrowser.open(tunnel_url)

        print("\nPresiona ENTER para detener todo y restaurar configuración local...")
        input()

    except KeyboardInterrupt:
        print("\n\nDetenido por el usuario.")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
    finally:
        print("\n--> Cerrando todo y restaurando...")
        
        if tunnel_proc:
            tunnel_proc.terminate()
            try:
                tunnel_proc.wait(3)
            except:
                tunnel_proc.kill()

        restore_env()

        # Limpieza final
        kill_process_on_port(5174)
        kill_process_on_port(8001)
        subprocess.call("taskkill /f /im cloudflared.exe >nul 2>&1", shell=True)

        print("--> Todo cerrado y restaurado correctamente.")


if __name__ == "__main__":
    main()