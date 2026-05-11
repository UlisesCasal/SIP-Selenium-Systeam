# Observabilidad Final — TP 2 Parte 4

Este directorio contiene los entregables de la Parte 4 del TP 2: Cierre y ADR magisterial sobre stacks de observabilidad.

## Archivos

| Archivo | Descripción |
|---------|-------------|
| [`measurements.md`](./measurements.md) | Mediciones empíricas del Hit #1: 7 métricas × 3 stacks, 3 muestras cada una, con comandos exactos y timestamps |
| [`decision-matrix.md`](./decision-matrix.md) | Matriz de decisión: 5 contextos × 5 stacks = 25 celdas con veredicto, razón y caveat |
| [`vendor-lockin-essay.md`](./vendor-lockin-essay.md) | Ensayo sobre vendor lock-in en observabilidad: 3 casos reales y estrategias de mitigación |
| [`screenshots/`](./screenshots) | Capturas de pantalla de las mediciones |

## ADR

| Archivo | Descripción |
|---------|-------------|
| [`docs/adr/0010-instrumentacion-vendor-neutral.md`](../adr/0010-instrumentacion-vendor-neutral.md) | ADR: Adopción de OTel como capa de instrumentación vendor-neutral |
| [`docs/adr/0012-stack-de-observabilidad-final.md`](../adr/0012-stack-de-observabilidad-final.md) | ADR magisterial: Stack final OTel + Loki + Grafana + Jaeger |

## Stacks evaluados

- **Loki + Grafana** (logs, Apache 2.0, liviano)
- **EFK** (Elasticsearch + Kibana, logs, ELv2, full-text search)
- **OTel Collector + Jaeger** (traces, Apache 2.0, liviano, sin storage local)
- **Vector + Loki** (alternativa considerada en matriz)
- **OpenSearch + OpenSearch Dashboards** (alternativa considerada en matriz)

## Stack final seleccionado

```
OTel Collector (DaemonSet) → Loki + Grafana (logs)
                           → Jaeger all-in-one (traces)
```

Ver ADR 0012 para fundamentos, mediciones y análisis de riesgos.

## Cómo se generaron las mediciones

Todas las mediciones del Hit #1 se tomaron sobre el cluster `k3d-sobel` (k3s v1.32, 1 server + 2 agents, ~6 GB RAM disponible para observabilidad).

**Procedimiento general:**
1. Cada stack se desplegó con Helm desde sus respectivos directorios (`observability/`, `efk/`, `otel/`) sin modificar los charts originales de Partes 1-3
2. Cada stack corrió junto al scraper de MercadoLibre en `ml-scraper` (CronJob cada hora)
3. Las métricas se midieron desde fuera del cluster (kubectl) o desde dentro (kubectl exec)
4. Los comandos exactos y timestamps ISO se documentaron inline debajo de cada valor
5. Las capturas de pantalla se tomaron con terminal maximizada, mostrando el prompt y el namespace

**Salvedades metodológicas:**
- Las mediciones de RAM/CPU y latencia se tomaron en la misma ventana de tiempo (2026-05-10 14:48–16:30 ART) con ~2-4 h de uptime del cluster
- Las de deploy (Métrica 4) se midieron por separado el 2026-05-11 sobre cluster limpio
- Los valores de imagen (Métrica 5) se obtuvieron vía Docker Hub API porque k3d usa containerd interno y no expone `docker image inspect` desde el host

Ver [`measurements.md`](./measurements.md) para el detalle completo.
