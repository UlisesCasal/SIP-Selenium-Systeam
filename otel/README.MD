# OpenTelemetry Collector + SDK — TP 2 · Parte 3

Stack de observabilidad unificado con fan-out simultáneo a Loki y Elasticsearch.

## Prerrequisitos

- Loki + Grafana en `observability` (TP 2 · Parte 1)
- EFK en `elastic` (TP 2 · Parte 2)
- Cluster k3d con 8+ GB RAM libre

## Instalación

```bash
cd otel
chmod +x install.sh
./install.sh
```

## Verificar fan-out

```bash
# 1. Disparar un Job
kubectl -n ml-scraper create job --from=cronjob/scraper-hourly verify-fanout

# 2. Loki - buscar log_id
# http://<node-ip>:30000 → Explore → {service="scraper"} | json

# 3. Elasticsearch - mismo log_id
# http://<node-ip>:30001 → Discover → scraper-logs-*

# 4. Jaeger (bonus traces)
# http://<node-ip>:30002
```

## Comandos útiles

```bash
# Logs del collector
kubectl -n otel logs daemonset/agent-collector --tail=50

# Ver CRD del collector
kubectl -n otel get otelcol

# Verificar agentes legacy apagados
kubectl -n observability get ds promtail
kubectl -n elastic get ds fluent-bit

# Disparar scraper manual para pruebas
kubectl -n ml-scraper create job --from=cronjob/scraper-hourly scraper-test
kubectl -n ml-scraper wait --for=condition=complete job/scraper-test --timeout=600s
```

## Estructura

| Archivo | Descripción |
|---------|-------------|
| `install.sh` | Script de instalación idempotente |
| `helm/otel-operator-values.yaml` | Values del OTel Operator |
| `manifests/namespace.yaml` | Namespace `otel` |
| `manifests/collector-agent.yaml` | CRD OpenTelemetryCollector (DaemonSet) |
| `manifests/rbac.yaml` | ServiceAccount + ClusterRole |
| `manifests/scraper-otlp-config.yaml` | ConfigMap con endpoint OTLP |
| `scraper-instrumentation/otel_setup.py` | SDK OTel Python |
| `screenshots/` | Capturas de cada hit |

## Referencias

- ADR 0010: `docs/adr/0010-instrumentacion-vendor-neutral.md`
- ADR 0012: `docs/adr/0012-stack-de-observabilidad-final.md`
