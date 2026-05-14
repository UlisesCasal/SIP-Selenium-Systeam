# 0010 — Adoptamos OpenTelemetry como capa de instrumentación vendor-neutral

- **Date:** 2026-05-09
- **Status:** Accepted
- **Deciders:** Equipo SIP 2026 (4 devs full-stack)
- **Referenced by:** 0012 (stack final de observabilidad)

---

## 1. Contexto

Tras las Partes 1 y 2 del TP 2 tenemos dos stacks completos de logging corriendo en paralelo sobre el mismo cluster k3d, con el mismo scraper de MercadoLibre como fuente de datos:

- **Loki + Promtail + Grafana** (namespace `observability`) — OSS, Apache 2.0, liviano (239 MiB RAM total medido).
- **EFK (Elasticsearch + Fluent Bit + Kibana)** (namespace `elastic`) — ELv2, full-text search, pesado (2.1 GiB RAM medido).

Ambos stacks funcionan. Cada uno tiene su propio DaemonSet de recolección (Promtail y Fluent Bit) que lee los mismos archivos `/var/log/pods/*`, parsea los mismos logs JSON, y los manda a su backend respectivo con su protocolo propio (Loki push API HTTP y Elasticsearch Bulk API).

Esto nos genera tres problemas:

1. **Duplicación operativa.** Dos DaemonSets que hacen lo mismo, cada uno con su configuración, sus recursos, sus logs que monitorear. En un cluster con 1 nodo son ~150 MB de overhead extra; en producción con 20 nodos son 3 GB de RAM perdidos en agentes redundantes.

2. **Lock-in incipiente.** Si hoy decidimos que Elasticsearch es mejor para nuestro equipo y apagamos Loki, perdemos toda la inversión en config de Promtail, dashboards de Grafana, y alerts basados en LogQL. Si mañana aparece Datadog como requisito del CTO, tenemos que instalar un tercer agente. Cada backend nos ata un poco más a su ecosistema.

3. **El código del scraper sabe demasiado.** Hoy usamos `python-json-logger` con `JsonFormatter` para emitir logs JSON a stdout. Esa decisión de logging es un detalle de implementación — si migramos a Datadog o New Relic, el módulo `logging_setup.py` entero cambia. El código de negocio no debería saber a qué backend van los logs.

OpenTelemetry es un proyecto CNCF graduated (2023) que define un protocolo (OTLP) y SDKs vendor-neutral. En 2026, los 4 grandes proveedores SaaS (Datadog, New Relic, Dynatrace, Splunk) y los principales OSS (Loki ≥ 2.9, Elasticsearch ≥ 8.10, Prometheus, Jaeger, Tempo) soportan OTLP nativo. Es el momento de adoptarlo.

---

## 2. Decisión

Adoptamos **OpenTelemetry Collector (modo Agent, DaemonSet) + SDK Python** como capa de instrumentación unificada para reemplazar a Promtail y Fluent Bit.

El collector se despliega como CRD `OpenTelemetryCollector` vía el operador oficial, en modo DaemonSet (1 pod por nodo), con el pipeline:

```
[filelog receiver + otlp receiver] → [k8sattributes + batch + transform processors] → [otlphttp/loki + elasticsearch exporters]
```

Esto significa:
- Un solo agente por nodo, no dos.
- El mismo log sale simultáneamente a Loki y a Elasticsearch (fan-out), verificado con un campo `log_id` único por línea.
- El scraper se re-instrumenta con el SDK de OTel para Python: `LoggerProvider` + `TracerProvider` con export OTLP/gRPC directo al collector, sin pasar por archivos stdout.

---

## 3. Consecuencias

### Positivas

- **Un solo agente.** Reemplazamos 2 DaemonSets por 1. Menos recursos, menos config, menos superficie de falla.
- **Desacople total.** El scraper habla OTLP y no sabe a qué backends van los datos. Cambiar de backend es editar 5 líneas del YAML del collector.
- **Opcionalidad real.** Si en 12 meses el CTO pide Datadog, agregamos un exporter `otlphttp/datadog` y listo — el scraper no se toca. Si el equipo se siente más cómodo con Kibana para debugging, los logs ya están en Elasticsearch.
- **Traces sin esfuerzo extra.** El mismo pipeline OTLP que usamos para logs sirve para traces (lo usamos en el Hit #6 con Jaeger).

### Negativas

- **Capa nueva de YAML.** El CRD del collector, los processors (k8sattributes, transform, batch), y los exporters son configuración nueva que aprender. Cada processor mal configurado puede fallar silenciosamente.
- **SDK Python menos maduro.** La API de logs en Python dejó de ser experimental recién en 2024. La versión 1.30.x es estable pero tiene menos adopción que Java o Go.
- **Latencia de batch.** El `BatchLogRecordProcessor` acumula logs antes de exportar (default: 5s o 512 records). Si el scraper termina muy rápido, los últimos logs pueden perderse si no se llama `shutdown()` explícitamente.

### Sacrificios

- **Complejidad temporal.** Durante el período de bake (1-2 semanas), mantenemos Promtail y Fluent Bit escalados a 0 pero disponibles para rollback rápido.
- **Cardinality en Loki.** Con OTel, cada attribute puede volverse label de Loki si no se configura explícitamente el mapeo. Controlamos los labels exportados para evitar la explosión de cardinalidad que vimos en el TP 2 · Parte 1.

---

## 4. ¿Por qué ahora y no después?

Tres razones:

1. **El estándar ya está maduro.** OTel es CNCF graduated desde 2023. Los 4 grandes SaaS (Datadog, New Relic, Dynatrace, Splunk) aceptan OTLP nativo. No es un riesgo tecnológico — es el estándar de facto.

2. **El costo de esperar es bajo, el de migrar después es alto.** Hoy tenemos 2 stacks chicos en un cluster de desarrollo. Re-instrumentar el scraper ahora cuesta ~4 horas de un developer. Si esperamos a tener 10 microservicios instrumentados con `python-json-logger`, cada uno con su propio módulo de logging, el refactor es proyecto de 2 semanas.

3. **La industria se mueve.** Elastic ya no es Apache 2.0 (ELv2 desde 2021). Grafana Labs agregó OTLP nativo a Loki. Los vendors compiten en features, no en protocolo — porque OTLP vuelve el protocolo commodity. Estar del lado de OTLP hoy es apostar a que el lock-in de observabilidad sea cosa del pasado.

---
