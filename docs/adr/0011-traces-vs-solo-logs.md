# 0011 — Trazas además de logs: ¿vale la pena en un scraper batch?

- **Date:** 2026-05-09
- **Status:** Accepted
- **Deciders:** Equipo SIP 2026 (4 devs full-stack)
- **Referenced by:** 0012 (stack final de observabilidad)

---

## 1. Contexto

En el TP 2 · Parte 3 implementamos el Hit #6 (bonus): tracing distribuido con OpenTelemetry SDK + Jaeger all-in-one sobre el scraper de MercadoLibre. El scraper es batch (CronJob que corre cada hora, dura ~2-5 minutos, y termina). No es un servicio web — es un pipeline lineal: fetch HTML → parsear resultados → guardar en PostgreSQL.

La pregunta es válida: si ya tenemos logs, ¿para qué sumar traces? Este ADR explica por qué decidimos hacerlo.

**Lo que medimos:** en nuestro measurements.md la latencia de consulta de Jaeger es p50 = 52 ms, p95 = 61 ms (ver Métrica 3). No medimos el overhead exacto que el SDK de OTel agrega por span porque no tenemos las herramientas para hacerlo con precisión — asumimos la documentación oficial que reporta overhead "despreciable" (< 1 %) para aplicaciones batch con I/O predominante.

## 2. Decisión

**Incorporamos tracing (spans OTLP → Jaeger) además de logs, con este alcance:**

- Un span por producto scrapeado que mide tiempo total por producto.
- Sub-spans automáticos de HTTP vía `RequestsInstrumentor` (las requests a MercadoLibre).
- El scraper es monolítico, así que no hay context propagation entre servicios.
- No instrumentamos base de datos — es una sola inserción al final.

## 3. Por qué sí

Tres razones:

**1. Visibilidad de tiempos reales que los logs no dan.** Con logs tenemos timestamps de inicio y fin del job. Con traces vemos cuánto tardó cada paso (fetch HTML vs parseo) y podemos identificar cuellos de botella. En un scraper donde algunas requests tardan segundos, saber qué producto se colgó es información de debugging que los logs no estructuran bien.

**2. El scraper se va a volver menos simple.** Hoy scrapea productos en serie. Si agregamos más fuentes o una cola de workers, el tracing distribuido cruza componentes. Tener el SDK puesto hoy hace que sumar spans nuevos sea agregar un `with tracer.start_as_current_span(...)` — no es un proyecto aparte.

**3. El costo marginal fue casi cero.** El TracerProvider ya estaba configurado (ADR 0010). Sumar tracing fue: (a) crear un tracer, (b) envolver la función con `with tracer.start_as_current_span(...)`, (c) agregar el exporter `otlp/jaeger` al pipeline del collector. Fueron minutos. Si OTel no unificara logs y traces, habría sido otro agente + otra configuración — y probablemente no lo habríamos hecho.

## 4. Consecuencias

### Positivas

- **Debugging de performance.** Cuando un scrape tarda el doble, entramos a Jaeger y vemos qué paso fue el lento.
- **Base para el futuro.** ADR 0012 §6 planea migrar a Tempo en 6 meses. El SDK ya está.

### Negativas

- **Overhead, aunque no lo medimos con precisión.** La documentación de OTel lo da por despreciable en apps batch. No obstante, en un scraper de ~2 minutos, si el overhead fuera ~1 % serían ~1.2 segundos extra — asumible.
- **Complejidad mental.** Una pipeline más de configuración. Si los traces no aparecen, hay un lugar más donde buscar (el pipeline `traces` del collector).
- **Jaeger en memoria = efímero.** Al reiniciar el pod, todas las trazas se pierden. Sirve para debugging inmediato, no para análisis histórico.

### Sacrificios

- **No instrumentamos DB.** El scraper termina con un INSERT a PostgreSQL. Agregar spans ahí requeriría instrumentar psycopg2. Para una sola query al final, el beneficio no justifica el esfuerzo ni el riesgo de agregar latencia a la escritura.

## 5. Referencias

- Screenshot de traza en Jaeger: `docs/observability-final/../otel/screenshots/hit6-trace-jaeger.png`
- Mediciones de latencia (Jaeger p50/p95): `docs/observability-final/measurements.md` (Métrica 3)
- ADR 0010: `docs/adr/0010-instrumentacion-vendor-neutral.md`
- ADR 0012: `docs/adr/0012-stack-de-observabilidad-final.md`
- OTel Python Tracing API: https://opentelemetry-python.readthedocs.io/en/stable/api/trace.html
