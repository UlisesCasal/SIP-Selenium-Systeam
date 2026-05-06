# 0009 — Evaluación de EFK como segundo stack de logging

- Date: 2026-05-20
- Status: Proposed (cierre formal en ADR 0010 de Parte 4)
- Deciders: Equipo Systeam

## Contexto

En Parte 1 adoptamos Loki + Promtail + Grafana (ADR 0007). En Parte 2 desplegamos EFK
en paralelo con dos objetivos: (a) obtener datos comparativos reales sobre el mismo
workload (scraper) y (b) entender los trade-offs antes de cerrar la decisión final
en Parte 4 con OTel.

Restricciones medidas:

- Cluster k3s single-node, ~8 GB RAM totales (con Loki y EFK simultáneos: ~3.5 GB).
- Mismos logs JSON del scraper (Hit #3 de Parte 1) van a los dos stacks.
- Retención 7 días en ambos.
- Licenciamiento: Loki es Apache 2.0; Elasticsearch es Elastic License v2 (source-available,
  NO OSS según OSI). En contexto académico no afecta; en empresa puede ser bloqueante.

## Decisión

NO se decide reemplazar Loki por EFK ni viceversa en esta Parte 2. La decisión se difiere
al ADR 0010 (Parte 4) cuando se haya evaluado también OTel.

Lo que sí se decide acá:

- Mantener los dos stacks corriendo en paralelo durante el TP.
- Documentar las dimensiones de comparación (ver tabla en TP 2 · Parte 2).
- Marcar EFK como "candidato fuerte" cuando el caso de uso requiera full-text search
  pesado, y "candidato descartado" cuando el footprint o licencia importen.

## Consecuencias

- Se gana visibilidad real sobre los trade-offs (no opinión, datos del propio cluster).
- Se gana experiencia con ECK Operator + ILM + KQL — útil aunque no se adopte EFK como
  principal.
- Se pierde RAM (~3.5 GB) durante el desarrollo. Mitigado bajando uno de los dos stacks
  durante coding y subiendo ambos para evaluación.
- Riesgo: introducir dependencia de Elastic License v2 en el repo. Mitigado: sólo se
  usan imágenes oficiales, no se redistribuye Elasticsearch ni se ofrece como servicio.

## Métricas medidas (en NUESTRO cluster)

- RAM Loki stack: `<medir>` Mi
- RAM EFK stack: `<medir>` Mi (ratio: `<calcular>`×)
- Latency Q1 (errores por producto 24h):
  - Loki: `<medir>` ms
  - EFK: `<medir>` ms
- Latency full-text "encontrar substring de 50 chars" en 7 días de logs:
  - Loki: `<medir>` seg
  - EFK: `<medir>` ms

## Referencias

- Tabla comparativa de la cátedra: TP 2 · Parte 2 / Material de apoyo
- Elastic License v2: https://www.elastic.co/licensing/elastic-license
- OpenSearch (alternativa OSS): https://opensearch.org/
