"""
agents — Dominio del Agente de Escaneo por IA (LLM vision).

Convierte imágenes de formularios de mapeo geomecánico escaneados en el
contrato estándar `excel_data` + `estructuras` que consume el pipeline de
importación existente (mismo shape que el importador de Excel).

Componentes:
  - config.py          : Settings del agente (env vars, key NUNCA expuesta).
  - llm_provider.py    : Cliente OpenRouter con fallback free -> pago.
  - prompt_builder.py  : Construcción del prompt (etiquetas formato A + catálogos).
  - normalizer.py      : Post-procesamiento JSON crudo -> shape del sistema.
  - scanner_service.py : Orquestación batch (multi-imagen, modos, duplicados).
  - schemas.py         : Contratos Pydantic de la API /api/scan/*.
  - router.py          : Endpoints REST.
"""
