# Test E2E del pipeline de importación con el Excel real de campo.
# Requisitos: venv del backend activo (o python con las dependencias de backend),
# node + npx disponibles, y el archivo Material\Estaciones_A21_23-04-2026.xlsx.
#
# Uso:  powershell -ExecutionPolicy Bypass -File run_tests.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== 1/3 Test del parser backend (Excel A21 -> preview) ===" -ForegroundColor Cyan
& (Join-Path $root "..\backend\venv\Scripts\python.exe") (Join-Path $root "test_import_e2e.py")
if ($LASTEXITCODE -ne 0) { Write-Host "FALLO en test_import_e2e.py" -ForegroundColor Red; exit 1 }

Write-Host "`n=== 2/3 Test de transformacion frontend (preview -> WindowData) ===" -ForegroundColor Cyan
& node (Join-Path $root "test_window_transform.mjs")
if ($LASTEXITCODE -ne 0) { Write-Host "FALLO en test_window_transform.mjs" -ForegroundColor Red; exit 1 }

Write-Host "`n=== 3/3 Test de estados de celda (celdas duplicadas BD vs BORRADOR) ===" -ForegroundColor Cyan
& node (Join-Path $root "test_cell_registry.mjs")
if ($LASTEXITCODE -ne 0) { Write-Host "FALLO en test_cell_registry.mjs" -ForegroundColor Red; exit 1 }

Write-Host "`n=== 4/4 Test de catálogos GSI, autocompletado, QA/QC y geometría ===" -ForegroundColor Cyan
& node (Join-Path $root "test_gsi.mjs")
if ($LASTEXITCODE -ne 0) { Write-Host "FALLO en test_gsi.mjs" -ForegroundColor Red; exit 1 }

Write-Host "`n=== 5/5 Test de helpers de import PLT (agrupación y re-etiquetado) ===" -ForegroundColor Cyan
& node (Join-Path $root "test_plt_import.mjs")
if ($LASTEXITCODE -ne 0) { Write-Host "FALLO en test_plt_import.mjs" -ForegroundColor Red; exit 1 }

Write-Host "`n=== 6/6 Test de Coordenadas PROYECTADAS (solo locales) ===" -ForegroundColor Cyan
& node (Join-Path $root "test_proyectadas.mjs")
if ($LASTEXITCODE -ne 0) { Write-Host "FALLO en test_proyectadas.mjs" -ForegroundColor Red; exit 1 }

Write-Host "`nTodos los tests pasaron OK" -ForegroundColor Green
