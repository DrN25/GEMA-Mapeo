# GUÍA DE ESTILOS DE INTERFAZ & BOTONES (VENTANAS 2.0)

Esta guía define las reglas de interfaz para asegurar que el sistema se vea moderno, premium y unificado (Estilo Obsidian Deep + Neon) sin caer en inconsistencias o botones opacos.

---

## 1. PRINCIPIOS DE CONFIGURACIÓN DE BOTONES
* **Capitalización de Texto**: NUNCA uses "uppercase" (MAYÚSCULAS) en las etiquetas de los botones. Usa la capitalización normal (ej. "Nueva Celda") para mantener una lectura limpia.
* **Grosor**: Todos los botones interactivos deben llevar la clase "font-bold" para un contraste de lectura óptimo.
* **Tamaño Estándar**: Mantener "text-xs" (12px) con un padding interno simétrico de "px-4 py-2" para botones de acción en barra de herramientas, y "px-3 py-1.5" para celdas o listas compactas.
* **Micro-interacciones**: Todo botón interactivo debe responder con una animación sutil al presionarlo ("active:scale-95") y una transición de color fluida ("transition-all duration-200").

---

## 2. PARÁMETROS CROMÁTICOS DE ACCIÓN (Cyber Neon)

### 🟣 VIOLETA ELÉCTRICO (Acciones Principales / Creación)
Se utiliza para botones que crean nuevos registros, inician flujos principales o muestran estados activos de cálculo.
* **Tailwind Class**: 
  `bg-violet-500/10 border border-violet-500/40 text-violet-400 hover:bg-violet-500/20 hover:border-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.12)]`
* **Ejemplos**: "Nueva Celda", "Crear Familia", "Nueva Fila", "Fórmulas Activas".

### 🟢 ESMERALDA DE CARGA (Importación, Exportación y Guardado Exitoso)
Se utiliza exclusivamente para interacciones con datos externos (Excel, descargas) o confirmaciones de base de datos exitosas.
* **Tailwind Class**: 
  `bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.12)]`
* **Ejemplos**: "Importar Excel", "Exportar Excel", "Guardar" (Sincronizado).

### 🔵 CIAN / CELESTE (Análisis, Catálogos e Informes)
Se utiliza para botones que abren modales de apoyo, resúmenes, catálogos de consulta o gráficos que no modifican datos en sí mismos.
* **Tailwind Class**: 
  `bg-sky-500/10 border border-sky-500/40 text-sky-400 hover:bg-sky-500/20 hover:border-sky-400 shadow-[0_0_12px_rgba(14,165,233,0.12)]`
* **Ejemplos**: "Catálogos", "Control QA/QC", "Reporte Resumen".

### 🟡 ÁMBAR / ORO (Estados Pendientes o Alertas)
Se utiliza para botones de guardado que registran cambios locales aún no subidos a SQL Server.
* **Tailwind Class**: 
  `bg-amber-500/10 border border-amber-500/40 text-amber-400 hover:bg-amber-500/20 hover:border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.12)]`
* **Ejemplos**: "Guardar" (Cambios pendientes).

### 🔴 ROJO FUEGO (Destrucción y Borrado)
Se utiliza para limpiezas de filas o eliminación permanente de registros.
* **Tailwind Class**: 
  `bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 hover:border-red-400 text-red-400 hover:text-red-300`
* **Ejemplos**: "Eliminar", "Borrar Familia".

### 🔘 PIZARRA / GRIS TRANSLÚCIDO (Retrocesos o Navegación)
Se utiliza para volver atrás o cerrar paneles sin guardar cambios directos.
* **Tailwind Class**: 
  `bg-slate-500/10 border border-slate-500/30 text-slate-300 hover:bg-slate-500/20 hover:border-slate-400`
* **Ejemplos**: "Volver al Panel", "Cancelar".