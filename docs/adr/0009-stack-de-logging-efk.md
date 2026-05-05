# 0009 — Stack EFK como evaluación comparativa frente a PLG

- **Date:** 2026-05-05
- **Status:** Proposed (en evaluación — se consolida en Parte 4)
- **Deciders:** Equipo SIP 2026

## Contexto

En la Parte 1 del proyecto adoptamos el stack **PLG** (Promtail + Loki + Grafana) para
logging centralizado (ver [ADR-0007](./0007-stack-de-logging.md)). Esa decisión fue
correcta para las restricciones iniciales (cluster k3s single-node, ~6 GB RAM, costo $0).

Sin embargo, el ADR-0007 dejó explícitamente abierta una consecuencia conocida: _Loki
indexa solo labels, no el cuerpo del log_. Para un scraper que genera mensajes
semiestructurados con campos dinámicos (`product`, `duration`, `browser`), la búsqueda
full-text es un requerimiento latente.

En la **Parte 2** necesitamos responder con datos objetivos a la pregunta:

> ¿Justifica el costo de recursos adicional de Elasticsearch la ganancia en capacidad
> de búsqueda y ergonomía de dashboards frente a Loki?

Para esto, desplegamos un stack **EFK** (Elasticsearch + Fluent Bit + Kibana) en el
namespace `elastic`, operando **en paralelo** con el stack PLG en `observability`.
Ambos consumen los **mismos logs** del namespace `ml-scraper`, permitiendo una
**calibración honesta** (same input, different backends).

### ¿Por qué coexistencia y no reemplazo?

No estamos reemplazando Loki. Lo mantenemos activo intencionalmente porque:

1. **Mismo input, misma ventana temporal**: ambos stacks ingestan los mismos logs de
   `ml-scraper`, lo que elimina el sesgo de "distintos workloads".
2. **Evaluación A/B real**: podemos medir latencia de query, footprint de memoria y
   ergonomía de dashboards lado a lado.
3. **Reversibilidad**: si EFK no aporta valor suficiente, basta con `helm uninstall` y
   `kubectl delete namespace elastic`. El stack PLG sigue operando intacto.
4. **Decisión informada en Parte 4**: la conclusión de este ADR se basa en métricas
   reales, no en benchmarks genéricos.

## Decisión

Desplegamos un stack **EFK sobre ECK** (Elastic Cloud on Kubernetes) con las siguientes
decisiones técnicas:

### Componentes y versiones

| Componente    | Mecanismo de deploy         | Versión                | Namespace        |
| ------------- | --------------------------- | ---------------------- | ---------------- |
| ECK Operator  | Helm `elastic/eck-operator` | `2.16.1`               | `elastic-system` |
| Elasticsearch | CRD `Elasticsearch`         | `8.17.1`               | `elastic`        |
| Kibana        | CRD `Kibana`                | `8.17.1`               | `elastic`        |
| Fluent Bit    | Helm `fluent/fluent-bit`    | `0.48.3` (App `3.2.x`) | `elastic`        |

### ¿Por qué ECK Operator?

El operador ECK gestiona el ciclo de vida completo de Elasticsearch y Kibana como CRDs
nativos de Kubernetes: upgrades rolling, gestión de certificados TLS, rotación automática
de passwords, y healthchecks integrados. Esto evita mantener StatefulSets y Secrets
manuales, reduciendo la superficie de error operativo.

### ¿Por qué Fluent Bit y no Fluentd?

| Criterio          | Fluentd            | Fluent Bit            |
| ----------------- | ------------------ | --------------------- |
| Lenguaje          | Ruby (CRuby)       | C                     |
| RAM típica        | ~60-100 MB         | ~5-10 MB              |
| Plugins           | >1000 (ecosistema) | ~100 (core + curados) |
| Modo de ejecución | Deployment         | DaemonSet nativo      |
| Overhead por nodo | Alto               | Mínimo                |

Fluent Bit consume **~10x menos RAM** que Fluentd. En un cluster k3s single-node donde
cada megabyte cuenta, esta diferencia es determinante. El subset de plugins de Fluent Bit
cubre nuestro caso de uso (tail → kubernetes filter → es output).

### Configuración de la JVM de Elasticsearch

```yaml
env:
  - name: ES_JAVA_OPTS
    value: "-Xms1g -Xmx1g"
resources:
  requests:
    memory: 2Gi
  limits:
    memory: 2Gi
```

Se fija el heap de la JVM a **1 GB** (min = max, evitando resizing dinámico) dentro de un
contenedor con límite de **2 GB**. El gigabyte restante lo consume la JVM fuera del heap
(off-heap buffers, memory-mapped files para Lucene, thread stacks). Esta es la
configuración recomendada por Elastic: _"set Xms and Xmx to no more than 50% of your
total memory"_.

## Análisis Comparativo: EFK vs. PLG

### 1. Footprint de recursos

#### Stack PLG (namespace `observability`)

| Componente | CPU request | CPU limit | RAM request | RAM limit |
| ---------- | ----------- | --------- | ----------- | --------- |
| Loki       | 100m        | 500m      | 256Mi       | **512Mi** |
| Promtail   | 50m         | 200m      | 64Mi        | 128Mi     |
| Grafana    | 100m        | 300m      | 128Mi       | 256Mi     |
| **Total**  | **250m**    | **1000m** | **448Mi**   | **896Mi** |

#### Stack EFK (namespace `elastic`)

| Componente    | CPU request | CPU limit  | RAM request | RAM limit  |
| ------------- | ----------- | ---------- | ----------- | ---------- |
| ECK Operator  | 100m        | 500m       | 256Mi       | 512Mi      |
| Elasticsearch | 500m        | 1000m      | 2Gi         | **2Gi**    |
| Kibana        | 500m        | 1000m      | 1Gi         | 1Gi        |
| Fluent Bit    | ~50m        | ~200m      | ~64Mi       | ~128Mi     |
| **Total**     | **~1150m**  | **~2700m** | **~3.3Gi**  | **~3.6Gi** |

#### Multiplicador de recursos

| Dimensión | PLG    | EFK     | Factor    |
| --------- | ------ | ------- | --------- |
| RAM total | 896 Mi | ~3.6 Gi | **≈4x**   |
| CPU total | 1000m  | ~2700m  | **≈2.7x** |

Elasticsearch por sí solo (**2 Gi**) consume **4x** la RAM total de Loki (**512 Mi**).
Este es el costo de mantener un índice invertido full-text con scoring BM25: la
capacidad de búsqueda es proporcional al consumo de memoria.

### 2. Latencia de query

| Dimensión                   | Loki (LogQL)                         | Elasticsearch (KQL/Lucene)         |
| --------------------------- | ------------------------------------ | ---------------------------------- |
| Búsqueda por label          | **O(1)** — índice de labels          | O(1) — índice invertido            |
| Full-text search            | **O(n)** — grep secuencial en chunks | **O(1)** — índice invertido + BM25 |
| Agregaciones numéricas      | Limitadas (unwrap + rate)            | Nativas (aggs framework)           |
| Query exploratoria          | Requiere conocer labels a priori     | Discover mode sin schema previo    |
| Latencia típica (100 logs)  | <100ms                               | <50ms                              |
| Latencia típica (100K logs) | 2-5s (grep distribuido)              | <200ms (índice invertido)          |

Para nuestro volumen actual (~100 logs/hora), **ambas opciones son sub-segundo**. La
diferencia se vuelve significativa en escenarios de escalado o queries exploratorias
ad-hoc.

### 3. Ergonomía de dashboards

| Criterio             | Grafana + Loki            | Kibana                                           |
| -------------------- | ------------------------- | ------------------------------------------------ |
| Exploración de logs  | Log panel (stream lineal) | **Discover** (tabla interactiva, filtros inline) |
| Dashboards           | Paneles configurables     | Lens (drag-and-drop, AI suggestions)             |
| Alertas              | Grafana Alerting (maduro) | Kibana Alerts + Watcher                          |
| Curva de aprendizaje | Baja (ya lo usamos)       | Media (nuevo para el equipo)                     |
| Query language       | LogQL (similar a PromQL)  | KQL (simple) + Lucene (avanzado)                 |

### 4. Licenciamiento (⚠ Crítico)

| Aspecto               | Loki + Grafana               | Elasticsearch + Kibana                |
| --------------------- | ---------------------------- | ------------------------------------- |
| Licencia              | **AGPL v3** (OSS)            | **Elastic License v2** (ELv2)         |
| OSI-approved          | ✅ Sí                        | ❌ **No**                             |
| Uso interno/académico | ✅ Sin restricciones         | ✅ Permitido                          |
| Uso como servicio     | Requiere abrir código fuente | ❌ **Prohibido** (cláusula anti-SaaS) |
| Forks OSS             | N/A                          | **OpenSearch** (Apache 2.0)           |

> **⚠ IMPORTANTE:** Elasticsearch y Kibana bajo ELv2 **no son Open Source** según la
> definición de la OSI. La licencia prohíbe explícitamente _"providing the software to
> third parties as a hosted or managed service, where the service provides users with
> access to any substantial set of the features or functionality of the software"_.
>
> Para nuestro uso académico en un cluster local esto **no aplica**. Sin embargo, si en
> la Parte 4 se decide adoptar EFK para producción como servicio, se deberá evaluar
> **OpenSearch** (fork Apache 2.0 mantenido por AWS) como alternativa 100% OSS que
> elimina esta restricción legal.

## Consecuencias

### Positivas

- **Calibración honesta**: operamos ambos stacks con el mismo input, lo que produce
  métricas comparativas válidas y elimina el sesgo de benchmark.
- **Búsqueda full-text real**: Elasticsearch resuelve la limitación documentada en
  ADR-0007 sobre grep lento en el cuerpo de los logs.
- **Experiencia técnica**: el equipo gana competencia operativa en dos ecosistemas de
  observabilidad distintos, valor diferencial para el proyecto.
- **Reversibilidad total**: el stack EFK está aislado en su propio namespace; eliminarlo
  no impacta al stack PLG.

### Negativas (trade-offs)

- **4x de consumo de RAM** respecto a Loki para el componente de almacenamiento.
  En un cluster de ~6 GB, correr ambos stacks simultáneamente consume ~4.5 GB solo en
  observabilidad. El scraper y RabbitMQ compiten por los ~1.5 GB restantes.
- **Complejidad operativa duplicada**: dos stacks de logging = dos conjuntos de
  dashboards, queries, y alertas que mantener.
- **Licencia restrictiva**: ELv2 limita opciones futuras de deployment comercial.
  Mitigado con el path de migración a OpenSearch documentado arriba.
- **Curva de aprendizaje**: el equipo necesita aprender KQL y la interfaz de Kibana
  en paralelo con LogQL y Grafana.

### Decisión pendiente (Parte 4)

Al finalizar el experimento comparativo, se consolidará este ADR con uno de estos
resultados:

| Resultado                       | Acción                                        |
| ------------------------------- | --------------------------------------------- |
| EFK aporta valor proporcional   | Adoptar EFK como stack principal, retirar PLG |
| PLG suficiente para el volumen  | Retirar EFK, mantener PLG (menor footprint)   |
| Ambos aportan valor diferencial | Mantener ambos con roles diferenciados        |

## Referencias

- ADR-0007 — Stack PLG: [0007-stack-de-logging.md](./0007-stack-de-logging.md)
- ECK documentation: https://www.elastic.co/guide/en/cloud-on-k8s/current/index.html
- Elastic License v2 FAQ: https://www.elastic.co/licensing/elastic-license
- OSI Open Source Definition: https://opensource.org/osd
- OpenSearch (Apache 2.0): https://opensearch.org/
- Fluent Bit vs Fluentd: https://docs.fluentbit.io/manual/about/fluentd-and-fluent-bit
- Elasticsearch heap sizing: https://www.elastic.co/guide/en/elasticsearch/reference/current/advanced-configuration.html#set-jvm-heap-size
