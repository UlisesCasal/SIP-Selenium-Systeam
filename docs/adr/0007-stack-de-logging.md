# 0007 — Adoptamos Loki + Promtail + Grafana para logging centralizado

- Date: 2026-05-04
- Status: Accepted
- Deciders: Equipo SIP 2026

## Contexto

El scraper corre como CronJob en k3s y emite logs a stdout. `kubectl logs` se vuelve
inutilizable en cuanto los pods son recolectados. Necesitamos un backend de logs con
retención mínima 7 días, queryable, y visualizable. Restricciones:
- Cluster local k3s single-node, ~6 GB RAM disponibles.
- Sin cloud / sin servicios pagos.
- Equipo familiarizado con Grafana.

Alternativas consideradas: Loki+Promtail, Loki+Alloy, Vector+Loki, OTel+Loki,
EFK, Datadog, Splunk. Tabla comparativa en TP 2 · Parte 1 / Material de apoyo.

## Decisión

Adoptamos **Loki + Promtail + Grafana** (charts separados, versiones pinneadas).

## Consecuencias

- Más fácil: setup en ~10 min con Helm (charts pinneados 6.16.0); integración nativa con dashboards Grafana; costo $0; modelo label-first es simple y suficiente para nuestro volumen (~100 logs/hora).
- Más difícil: full-text grep es lento (Loki indexa labels, no el cuerpo del log) — si en el futuro queremos búsquedas tipo "encontrame el log con esta substring de 100 chars" vamos a sufrir.
- Sacrificio: no podemos hacer queries complejas tipo SQL (vs Splunk SPL).
- Riesgo: cardinality explosion si labelean mal. Mitigado en Hit #2 con regla de ≤10 labels totales y ningún label de cardinalidad alta (no usamos pod_uid, request_id, etc.).

### Comparación de alternativas descartadas:

| Stack | Por qué se descartó |
|-------|---------------------|
| **Loki + Alloy** | Alloy es sucesor de Promtail pero menos documentado en 2026; para un TP académico Promtail tiene más ejemplos claros |
| **Vector + Loki** | Vector es excelente (Rust, performante) pero requiere mantener otro componente y config syntax distinta; overhead innecesario para el TP |
| **OTel Collector + Loki** | OTel logs aún en evolución en 2026; madurez menor que stack maduro Loki+Promtail |
| **EFK (Elasticsearch+Fluentd+Kibana)** | Elasticsearch pide mínimo 2 GB RAM solo; no entra cómodo en k3s local de 6 GB. Se aborda en Parte 2 como comparativa |
| **Datadog Logs** | SaaS paid ($0.10/GB ingested); vendor lock-in; no aplica para cluster local sin cloud |
| **Splunk Cloud** | Costo enterprise prohibitivo para uso académico; on-prem complejo de operar |

## Referencias

- Loki design doc: https://grafana.com/docs/loki/latest/get-started/architecture/
- Comparativa de la cátedra: TP 2 / Material de apoyo
- Prometheus label best practices aplican a Loki: https://prometheus.io/docs/practices/naming/
