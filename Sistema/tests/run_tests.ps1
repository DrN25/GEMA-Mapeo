# Test E2E del pipeline de importación con el Excel real de campo.
# Requisitos: venv del backend activo (o python con las dependencias de backend),
# node + npx disponibles, y el archivo Material\Estaciones_A21_23-04-2026.xlsx.
#
# Uso:  powershell -ExecutionPolicy Bypass -File run_tests.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== 1/2 Test del parser backend (Excel A21 -> preview) ===" -ForegroundColor Cyan
& (Join-Path $root "..\backend\venv\Scripts\python.exe") (Join-Path $root "test_import_e2e.py")
if ($LASTEXITCODE -ne 0) { Write-Host "FALLO en test_import_e2e.py" -ForegroundColor Red; exit 1 }

Write-Host "`n=== 2/2 Test de transformacion frontend (preview -> WindowData) ===" -ForegroundColor Cyan
& node (Join-Path $root "test_window_transform.mjs")
if ($LASTEXITCODE -ne 0) { Write-Host "FALLO en test_window_transform.mjs" -ForegroundColor Red; exit 1 }

Write-Host "`nTodos los tests pasaron OK" -ForegroundColor Green
