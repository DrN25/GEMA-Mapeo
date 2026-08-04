# validador_geomecanico.py
import argparse
import sys
import os

# Asegurar la visibilidad de la carpeta app en el path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.utils.validator import validate_bulk_excel

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Conector de Consola para Validador Geomecánico v2.0")
    parser.add_argument("--input", required=True, help="Ruta de acceso a la planilla Excel (.xlsx, .xls)")
    parser.add_argument("--output", default="salida_metricas.json", help="Ruta del JSON de analíticas de salida")
    
    args = parser.parse_args()
    if not os.path.exists(args.input):
        print(f"[-] Archivo de entrada inexistente: {args.input}")
        sys.exit(1)
        
    validate_bulk_excel(args.input, args.output)
    print("[+] Validación masiva ejecutada correctamente.")