# Validación de mapeo: mantenimiento y comprobación

La autoridad de QAQC de ventanas reside en `backend/app/validation/`. React solicita evaluaciones; no mantiene otra lista de predicados de mapeo. PLT conserva su validador y sus obligatorios independientes.

## Puntos de entrada

- `registry.py`: metadatos, categorías, aliases, parámetros de geometría, activación, scope y operaciones. Conserva los códigos BE para reportes e históricos.
- `predicates.py`: predicados BE extraídos sin reescribir sus fórmulas. No tiene dependencias de SQL ni de FastAPI.
- `window_rules.py`: reglas antes exclusivas del editor. Cada registro reúne parámetros y evaluador; la proyección pública se genera desde él.
- `fields.py`: campos obligatorios del formulario de mapeo y etiquetas.
- `derived.py`: GSI efectivo y orientación automática. Los demás cálculos RMR de presentación/persistencia conservan su implementación existente.
- `adapters.py`: conversiones de borrador, payload de guardado e importación A/B; aliases de columnas de revisión.
- `service.py`: evaluación de ventanas y extensiones de revisión; incidencias, bloqueo, catálogo y versión.
- `excel.py`: lectura, filas padre/hija, cancelación y diagnóstico. Conserva la política legacy de obligatoriedad por columnas presentes y tipo de fila para mantener compatibilidad con las planillas existentes. No aplica los 44 obligatorios del formulario indiscriminadamente al Excel.
- `context.py`: catálogo de campañas de aplicación, anteriormente duplicado en TypeScript. El endpoint de catálogos lo sirve al selector existente.

`app/core/rules.py` y `app/utils/validator.py` son fachadas para mantener los imports anteriores. La nueva vista de tabs puede usar `GET /api/validation/rules`, que distingue `views`, `scope`, `operations`, estado y versión. Su construcción visual queda para la tarea futura prevista.

## Comportamiento

El editor agrupa cambios durante 300 ms y descarta respuestas de una edición o ventana anterior. Un borrador modificado deja de tener aprobación inmediatamente. Sin servicio se conservan borradores, pero el guardado requiere una evaluación actual. El guardado de todas las pendientes evalúa también las importadas sin abrirlas. La caché conserva versión y huella del borrador como información, nunca como autorización para saltar la evaluación.

`POST /api/ventanas` y `POST /api/importar-excel/ejecutar` evalúan antes de mutaciones y de resoluciones de catálogo que pudieran insertar registros. Devuelven 422 con `detail.code=VALIDATION_FAILED` para críticas/vacíos. Los permisos existentes permanecen. Las advertencias permiten guardar. La atomicidad continúa siendo por celda en el guardado múltiple del editor; no se añadió una transacción global.

El modo actual automático de orientación/GSI valida y persiste valores efectivos, no valores antiguos de campos de solo lectura. El largo declarado conserva decimales, se muestra sin redondearlo a entero y admite la tolerancia BE de 0.03 m para distancia de estructura. Si no hay largo declarado y las coordenadas permiten obtenerlo, se usa el largo físico. Los controles ya no recortan silenciosamente distancias y otros límites de dominio antes de evaluarlos.

Decisiones de consolidación: DIP de estructura [0,90] como el predicado BE; `c`/`cwf` se reconocen como limpio, y ausencia de material se informa como vacío. GSI negativo/entero/rango usan el valor efectivo en modo automático; revisión Excel conserva el valor reportado. Cuatro reglas BE previamente declaradas sin emisión continúan como `documented_only` deshabilitadas.

Se mantiene el denominador legacy 77 en métricas existentes. Nuevos diagnósticos/compactos llevan `ruleset_version`; comparativos añaden una hoja de versiones y advierten criterios distintos/desconocidos. No se reescribe el historial.

## Modificar reglas

Para una regla nueva de campos de ventana, agregar un registro a `WINDOW_RULES` mediante `add` con ID estable, campo, mensaje, tipo de evaluador, parámetros y severidad. Si se necesita un predicado distinto, agregar su evaluación en `WindowRule.fails`. No copiar condiciones a React. Comprobar aliases, columna, contexto y disponibilidad de insumos Excel. Para una regla BE, mantener definición y emisión en el paquete y declarar su alcance en el registro; una entrada de catálogo sola no la implementa. Las pruebas verifican que toda regla activa tenga un punto de emisión.

`scope` indica consumidor: frontend, backend o ambos. El ejecutor siempre es Python. No configurar invariantes críticas de persistencia como solo frontend. `operations` determina preview/save/importación/revisión; `views` determina las tabs futuras y no reemplaza el ámbito de ejecución.

Agregar casos de límite y de adaptadores. Las huellas versionan también normalización, derivados y catálogos estáticos, normalizando finales de línea. No activar las cuatro reglas documentadas sin añadir su implementación y pruebas. No editar snapshots JSON del catálogo: el fallback manual fue retirado.

## Comandos de comprobación

Desde `Sistema/backend`, con las dependencias locales existentes:

```powershell
.\.venv\Scripts\python.exe tests/run_validation_isolated.py
```

El runner sustituye SQL y autenticación antes de importar routers: cualquier intento de SQL falla. No inicia la aplicación ni carga su configuración de conexión. La suite comprueba reglas, adaptadores, handlers, geología, reportes por rol y exportación. Las pruebas de handlers son llamadas directas a las funciones y modelos reales; no sustituyen una prueba HTTP completa ni prueban login/JWT.

Desde la raíz del repositorio:

```powershell
node .\Sistema\tests\test_validation_client.mjs
```

Comprueba contratos, respuestas atrasadas, desconexión, obligatoriedad PLT y 70 escenarios de paridad GSI con el calculador de presentación. Compila módulos en `Sistema/tests/.cache/`, ignorado por Git, sin instalar dependencias.

Desde `Sistema/frontend`:

```powershell
npm.cmd run build
```

Después de actualizar el código, reiniciar backend y frontend y recargar el navegador. No hay migraciones ni paquetes nuevos que instalar. Antes de producción, comprobar en la copia local conectada explícitamente a la BD de pruebas: editar una ventana, crítica/vacío/advertencia, guardar activa/todas, importación y descarga de reporte. La validación automatizada aislada no escribe ni comprueba la instancia SQL real.
