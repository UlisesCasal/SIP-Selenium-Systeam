# 0009 — Evaluación de EFK como segundo stack de logging

- Date: 2026-05-20
- Status: Proposed
- Deciders: Equipo Systeam

## Contexto

En Parte 1 se adoptó Loki + Promtail + Grafana.
En Parte 2 se despliega EFK en paralelo.
Ambos stacks leen los mismos logs del namespace `ml-scraper`.
El objetivo NO es reemplazar Loki todavía.
El objetivo es comparar:

- footprint,
- latencia,
- ergonomía,
- capacidades de búsqueda,
- complejidad operativa,
- licenciamiento.

## Restricciones

- k3s single-node
- ~8 GB RAM
- Retención de 7 días
- Logs JSON estructurados

## Tabla de recursos

| Componente    | Requests             | Limits               | Storage  |
| ------------- | -------------------- | -------------------- | -------- |
| ECK Operator  | 50m CPU / 128Mi RAM  | 100m CPU / 256Mi RAM | —        |
| Elasticsearch | 500m CPU / 1Gi RAM   | 1000m CPU / 2Gi RAM  | 10Gi PVC |
| Kibana        | 200m CPU / 512Mi RAM | 500m CPU / 1Gi RAM   | —        |
| Fluent Bit    | 50m CPU / 64Mi RAM   | 200m CPU / 128Mi RAM | —        |

Loki single-binary consumía ~256/512Mi.
Elasticsearch consume ~4× más RAM.
Ambos stacks simultáneos generan presión real de memoria.

## Heap JVM

Elasticsearch usa JVM.
Por defecto toma ~50% RAM.
Se configuró explícitamente:

```yaml
env:
  - name: ES_JAVA_OPTS
    value: "-Xms1g -Xmx1g"
```

Hacerlo explícito asegura que Elasticsearch asigne exactamente la cantidad de memoria especificada en su inicialización, evitando que intente expandir el heap durante picos de trabajo. Al bloquear la asignación de memoria (`Xms` igual a `Xmx`), se garantiza que quede memoria RAM disponible dentro del pod para el sistema operativo y las estructuras críticas fuera del heap, evitando que el OOMKiller de Kubernetes destruya el contenedor.

## Licenciamiento

Elasticsearch/Kibana usan Elastic License v2.
NO es OSS según OSI.
El cambio ocurrió post-2021, lo que originó el fork OpenSearch.
Para uso académico está permitido.
En un entorno corporativo, las implicancias empresariales limitan estrictamente la capacidad de ofrecer el motor como un servicio gestionado.
Esto introduce un riesgo latente de vendor lock-in a nivel de arquitectura corporativa.

## Alternativa OSS

- OpenSearch
- OpenSearch Dashboards
- Apache 2.0
- fork mantenido por AWS

## Diferencia conceptual Loki vs Elasticsearch

Loki trabaja con streams y labels.
Elasticsearch trabaja con documentos indexados.
Existe una profunda diferencia entre la velocidad de búsqueda y el costo de indexación derivado de las estructuras internas.

```logql
{level="ERROR"} |= "iphone"
```

```kql
level: "ERROR" and producto: "iphone"
```

Ambas queries responden la misma pregunta pero usando modelos internos distintos.

## Decisión

NO se adopta EFK como stack definitivo todavía.
La decisión queda abierta hasta ADR 0010.
Se decide mantener Loki y EFK en paralelo.

## Tabla comparativa

| Dimensión             | Loki                | EFK                  |
| --------------------- | ------------------- | -------------------- |
| Modelo                | Streams etiquetados | Documentos indexados |
| Full-text search      | Limitado            | Muy fuerte           |
| Footprint RAM         | Bajo                | Alto                 |
| Complejidad operativa | Baja                | Media/Alta           |
| Licencia              | Apache 2.0          | ELv2                 |
| Queries               | LogQL               | KQL                  |
| Escalabilidad         | Buena               | Muy buena            |
| Costo de indexación   | Bajo                | Alto                 |

## Consecuencias

### Positivas

- Obtención de métricas comparativas empíricas en igualdad de condiciones.
- Evaluación directa de las capacidades analíticas que ofrecen Kibana y KQL.

### Negativas

- Aumento sustancial en el consumo global de memoria RAM del entorno.
- Duplicación del esfuerzo y la carga operativa al gestionar dos sistemas paralelos.

## Riesgos

Existe una alta posibilidad de sobrecarga de cluster debido al gran consumo de recursos en un entorno single-node sin réplicas. Como mitigaciones, se aplican límites de recursos estrictos en los contenedores para evitar la caída total del sistema.

## Métricas medidas

- footprint RAM: `<medir>`
- latencia Q1: `<medir>`
- full-text search: `<medir>` (Loki) vs `<medir>` (EFK), con un ratio de `<calcular>`×.

## Referencias

- Elastic License
- OpenSearch
- KQL docs
- Material TP2 Parte 2
