# 0004 — Estrategia centralizada de Logs

- **Date:** 2026-05-01
- **Status:** Accepted
- **Deciders:** Grupo Systeam

## Contexto

A medida que el sistema de extracción crece, realizar el seguimiento de lo que ocurre durante la ejecución (especialmente cuando falla un selector o hay un error de red) se vuelve complejo. 
El enfoque tradicional de usar múltiples llamadas a `console.log()`, `console.warn()` o `console.error()` dispersas por todo el código genera una salida estándar caótica. No proporciona un formato consistente, carece de marcas de tiempo precisas y no permite filtrar fácilmente por nivel de severidad (por ejemplo, ver solo los errores sin el ruido de los mensajes informativos). Además, la cátedra exige explícitamente el uso de logs estructurados como buena práctica.

## Decisión

Decidimos implementar un módulo centralizado para el manejo de logs, ubicado en `src/utils/logger.js`[cite: 1]. 

A partir de esta decisión, se prohíbe el uso de `console.log()` crudo en la lógica de negocio y en los scrapers. Cualquier evento, advertencia o error que deba registrarse debe pasar por nuestra utilidad `logger`, la cual se encarga de estandarizar el formato de salida (incluyendo timestamps, nivel de severidad y el mensaje).

## Consecuencias

- **Positivas (Beneficios):**
  - **Trazabilidad mejorada:** Al tener un formato estandarizado, es mucho más fácil leer el historial de ejecución y diagnosticar en qué punto exacto falló un script E2E.
  - **Filtrado por niveles:** Nos permite configurar (ahora o en el futuro) el nivel de verbosidad. Por ejemplo, mostrar todos los logs en desarrollo (DEBUG/INFO), pero solo registrar errores (ERROR) en los entornos de Integración Continua (CI).
  - **Flexibilidad futura:** Si más adelante decidimos guardar los logs en un archivo físico o enviarlos a un servicio externo (como Elasticsearch o Datadog), solo tenemos que modificar el archivo `logger.js`[cite: 1] en lugar de refactorizar docenas de archivos.

- **Negativas (Trade-offs):**
  - **Curva de adopción:** Requiere disciplina por parte del equipo. Los desarrolladores deben recordar importar el módulo `logger.js`[cite: 1] en cada archivo nuevo en lugar de usar la consola nativa de Node.js por inercia.
  - **Ligero overhead:** Añade un pequeño nivel de indirección al proceso de desarrollo, ya que requiere invocar un módulo externo para una tarea trivial.

## Referencias

- The Twelve-Factor App - Logs: https://12factor.net/es/logs
- Node.js Best Practices - Logging: https://github.com/goldbergyoni/nodebestpractices/blob/master/README.spanish.md#2-pr%C3%A1cticas-de-manejo-de-errores