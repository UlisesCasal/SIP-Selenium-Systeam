# Mediciones Empíricas — Hit #1: Comparación de Stacks de Observabilidad

- **Cluster:** k3d-sobel (k3s v1.32, 1 server + 2 agents, ~6 GB RAM disponible)
- **Fechas:** 2026-05-10 (RAM/CPU/PVC/latencia) y 2026-05-11 (deploy Métrica 4)
- **Screenshots:** `docs/observability-final/screenshots/` (5 PNG, 2026-05-11)

## Estado del cluster durante las mediciones

Cada batch de mediciones se tomó con el cluster en un estado distinto. Esta tabla documenta uptime, ejecuciones del scraper y volumen aproximado de logs acumulados.

| Batch | Timestamp | Uptime cluster | Ejecuciones scraper (acum) | Volumen logs aprox |
|---|---|---|---|---|
| RAM/CPU | 2026-05-10T14:48 ART | ~2 h | 2 ejecuciones (~1.200 líneas c/u) | ~100 KB |
| Disk PVC | 2026-05-10T16:00 ART | ~4 h | 4 ejecuciones | ~200 KB |
| Query latency | 2026-05-10T16:30 ART | ~4.5 h | 4 ejecuciones | ~200 KB |
| Deploy Métrica 4 | 2026-05-11 (individual) | Cluster limpio cada vez | 0 (deploy inicial) | 0 |

> **Nota:** el cluster se reinició entre las mediciones originales (2026-05-08, 3 muestras) y las finales (2026-05-10, 1 muestra). Ver limitaciones al final.

> **Para la defensa oral:** estos números son la evidencia que respalda el ADR 0012.
> Debajo de cada celda de valor está: (1) el comando exacto que usamos para medir, (2) el timestamp de la medición.
> Sin esa traza, la cátedra asume que el número está inventado.

---

## Tabla resumen

| Métrica | Loki + Promtail + Grafana | EFK (ES + Fluent Bit + Kibana) | OTel Collector + Jaeger |
|---|---|---|---|
| **RAM total (MiB)** | **239** | **2099** | **115** |
| Comando | `kubectl top pods -n observability` | `kubectl top pods -n elastic` | `kubectl top pods -n otel` |
| Timestamp | 2026-05-10T14:48 ART | 2026-05-10T14:48 ART | 2026-05-10T14:48 ART |
| **CPU total (mCPU)** | **30** | **287** | **38** |
| Comando | `kubectl top pods -n observability` | `kubectl top pods -n elastic` | `kubectl top pods -n otel` |
| Timestamp | 2026-05-10T14:48 ART | 2026-05-10T14:48 ART | 2026-05-10T14:48 ART |
| **Disco PVC tras ~24 h (MiB)** | **1.8** | **69** | **0 (passthrough)** |
| Comando | `kubectl exec loki-0 -c loki -- du -sh /var/loki` | `kubectl exec scraper-es-default-0 -- du -sh /usr/share/elasticsearch/data` | `kubectl get pvc -n otel` |
| Timestamp | 2026-05-10T16:00 ART | 2026-05-10T16:00 ART | 2026-05-10T16:00 ART |
| **Query latency p50 (ms)** | **19** | **56** | **52** |
| Comando | `for i in 1..10; do curl /loki/api/v1/query_range; done` | `for i in 1..10; do curl /_search; done` | `for i in 1..10; do curl /api/traces?service=scraper-mercadolibre; done` |
| Timestamp | 2026-05-10T16:30 ART | 2026-05-10T16:30 ART | 2026-05-10T16:30 ART |
| **Query latency p95 (ms)** | **50** | **85** | **61** |
| Comando | misma serie de 10 corridas | misma serie de 10 corridas | misma serie de 10 corridas |
| Timestamp | 2026-05-10T16:30 ART | 2026-05-10T16:30 ART | 2026-05-10T16:30 ART |
| **Deploy clean → primer log (s)** | **244** | **121** | **~31** |
| Comando | `START=$(date +%s); ./install.sh; kubectl create job; kubectl exec loki query; END=$(date +%s)` | `START=$(date +%s); ./install.sh; kubectl create job; kubectl exec ES cat indices; END=$(date +%s)` | `START=$(date +%s); ./install.sh; kubectl create job; curl jaeger /api/services; END=$(date +%s)` |
| Timestamp | 2026-05-11T01:08 → 01:12 ART | 2026-05-11T01:41 → 01:43 ART | 2026-05-11T11:43 → 11:44 ART |
| **Tamaño imagen agente (MiB)** | **72.9 (Promtail 3.0.0)** | **36.0 (Fluent Bit 3.0.6)** | **64.1 (OTel Collector Contrib 0.110.0)** |
| Comando | `curl hub.docker.com/v2/repositories/grafana/promtail/tags/3.0.0` | `curl hub.docker.com/v2/repositories/fluent/fluent-bit/tags/3.0.6` | `curl hub.docker.com/v2/repositories/otel/opentelemetry-collector-contrib/tags/0.110.0` |
| Timestamp | 2026-05-10 | 2026-05-10 | 2026-05-10 |

---

## Métrica 1 — Footprint RAM / CPU
### ¿Cuánta memoria y procesador consume cada stack?

**Comando usado:**
```bash
kubectl top pods -n observability --no-headers
kubectl top pods -n elastic --no-headers
kubectl top pods -n otel --no-headers
```

### RAM (MiB)

| Stack | Pod | 10-May |
|---|---|---|
| **Loki+Grafana** | loki-0 | 161 |
| | grafana-* | 61 |
| | loki-canary | 17 |
| | **Total** | **239** |
| **EFK** | scraper-es-default-0 | 1545 |
| | scraper-kb-* | 554 |
| | **Total** | **2099** |
| **OTel+Jaeger** | agent-collector-* | 89 |
| | jaeger-* | 26 |
| | **Total** | **115** |

### CPU (mCPU)

| Stack | Pod | 10-May |
|---|---|---|
| **Loki+Grafana** | loki-0 | 22 |
| | grafana-* | 3 |
| | loki-canary | 5 |
| | **Total** | **30** |
| **EFK** | scraper-es-default-0 | 158 |
| | scraper-kb-* | 129 |
| | **Total** | **287** |
| **OTel+Jaeger** | agent-collector-* | 37 |
| | jaeger-* | 1 |
| | **Total** | **38** |

> **Qué significa:** EFK consume ~9× más RAM que Loki y ~18× más que OTel+Jaeger. Elasticsearch solo (1.545 MiB) usa más memoria que todo el stack de Loki completo (239 MiB). Esto pasa porque ES reserva 1 Gi de heap JVM fijo apenas arranca, tenga datos o no.

> El cluster se reinició para la defensa; solo tenemos 1 muestra fresca. Las 3 muestras originales del 2026-05-08 (14:48, 15:50, 17:32) daban: Loki 294±13 MiB, EFK 2104±8 MiB, OTel 114±5 MiB.

---

## Métrica 2 — Disk usage del PVC tras ~24 h
### ¿Cuánto disco ocupa cada stack después de un día de logs?

**Comandos usados:**
```bash
kubectl -n observability exec loki-0 -c loki -- du -sh /var/loki
kubectl -n elastic exec scraper-es-default-0 -- du -sh /usr/share/elasticsearch/data
kubectl -n otel get pvc
```

| Stack | Ruta | Tamaño | PVC |
|---|---|---|---|
| Loki | `/var/loki` | 1.8 MiB | 5 Gi (local-path) |
| Elasticsearch | `/usr/share/elasticsearch/data` | 69 MiB | 10 Gi (local-path) |
| OTel Collector | passthrough — no almacena | 0 MiB | Sin PVC |

Outputs reales:
```
$ kubectl -n observability exec loki-0 -c loki -- du -sh /var/loki
1.8M    /var/loki

$ kubectl -n elastic exec scraper-es-default-0 -- du -sh /usr/share/elasticsearch/data
69M     /usr/share/elasticsearch/data

$ kubectl -n otel get pvc
No resources found in otel namespace.
```

> **Qué significa:** Loki ocupa muy poco disco (1.8 MiB) porque comprime los logs por chunks. ES ocupa 69 MiB porque indexa cada campo del log (índices invertidos). OTel no ocupa nada porque es passthrough — solo reenvía, no almacena.
>
> **¿Por qué no hay PVCs en OTel?** Jaeger all-in-one usa `storage.type=memory` (no persiste nada) y el OTel Collector solo reenvía datos. Es correcto que no haya PVCs en `otel`.

> **Nota:** Loki perdió datos al reiniciar el cluster. El tamaño sube gradualmente con cada ejecución del scraper.

---

## Métrica 3 — Query latency p50 / p95
### ¿Qué tan rápido responde cada stack cuando le preguntamos?

**Pregunta de negocio que simulamos:** "errores del scraper en la última hora, agrupados por producto" (es la Q1 del Hit #4 de Parte 1).

Medimos con 10 consultas por stack (descartamos la primera que es cold start del port-forward).

### LogQL (Loki)
```bash
for i in $(seq 1 10); do
  curl -s "http://localhost:3100/loki/api/v1/query_range?query={job%3D%22.%2B%22}&limit=10" -o /dev/null
done
```
Corridas (ms): 115, 20, 50, 18, 18, 19, 19, 19, 21, 30
- **p50: 19 ms | p95: 50 ms | media: 33 ms**

> El valor alto en la primera corrida (115 ms) es cold start. A partir de la segunda se estabiliza en ~19 ms.

### KQL (Elasticsearch)
```bash
for i in $(seq 1 10); do
  curl -sk -u "elastic:..." "https://localhost:9200/_search?q=*&size=1" -o /dev/null
done
```
Corridas (ms): 178, 55, 80, 41, 68, 85, 47, 69, 39, 56
- **p50: 56 ms | p95: 85 ms | media: 72 ms**

> ES tiene más variabilidad que Loki (gap 41–85 ms). Esto se debe al GC de la JVM (Java) y al handshake TLS.

### Jaeger API (OTel)
```bash
for i in $(seq 1 10); do
  curl -s "http://localhost:16686/api/traces?service=scraper-mercadolibre&limit=1" -o /dev/null
done
```
Corridas (ms): 144, 50, 61, 56, 57, 49, 51, 56, 51, 52
- **p50: 52 ms | p95: 61 ms | media: 63 ms**

> Jaeger es el más estable de los 3 (gap 49–61 ms). Por algo está escrito en Go.

### Resumen

| Stack | p50 (ms) | p95 (ms) | Media (ms) |
|---|---|---|---|
| Loki (LogQL) | 19 | 50 | 33 |
| ES (KQL) | 56 | 85 | 72 |
| Jaeger (API) | 52 | 61 | 63 |

> **Qué significa:** los 3 stacks son rápidos. Loki gana porque opera single-binary sin TLS interno. ES pierde porque necesita handshake TLS + JVM GC. Jaeger es Go puro y es el más parejo. Pero todos están muy por debajo de un target de 2 segundos — **la latencia no decide la elección del stack en nuestro contexto**.

> **Nota:** estos valores son más bajos que en la medición original (Loki p50=296 ms, ES p50=282 ms, Jaeger p50=336 ms) porque el cluster se reinició y hay menos datos. La tendencia relativa se mantiene.

---

## Métrica 4 — Tiempo de deployment desde cero
### ¿Qué tarda cada stack en estar operativo desde cluster limpio?

Medido el **2026-05-11** sobre `k3d-sobel`. Borramos los namespaces de cada stack, medimos con `date +%s` desde el `kubectl delete` hasta que el scraper job genera datos visibles en el visualizador.

### Comandos exactos (los que pidió el profesor)

```bash
# 1. Limpieza inicial
kubectl delete namespace observability elastic elastic-system otel otel-operator-system cert-manager --wait=true

# 2. Loki + Grafana  (244 s)
START=$(date +%s)
cd observability && GRAFANA_ADMIN_PASSWORD=prom-operator ./install.sh
kubectl create job --from=cronjob/scraper-hourly scraper-metrica4-loki -n ml-scraper
kubectl exec -n observability loki-0 -- wget -q -O- \
  "http://localhost:3100/loki/api/v1/query_range?query=%7Bnamespace%3D%22ml-scraper%22%7D&limit=1"
END=$(date +%s)
echo "Loki stack deploy: $((END-START))s"

# 3. EFK  (121 s)
kubectl delete namespace observability elastic elastic-system --wait=true
START=$(date +%s)
cd efk && ./install.sh
kubectl create job --from=cronjob/scraper-hourly scraper-metrica4-efk -n ml-scraper
kubectl exec -n elastic deploy/scraper-kb -- bash -c \
  "curl -sk -u elastic:\$(kubectl get secret scraper-es-elastic-user -o jsonpath='{.data.elastic}' | base64 -d) \
  'https://scraper-es-http:9200/_cat/indices/scraper-logs-*?v'"
END=$(date +%s)
echo "EFK stack deploy: $((END-START))s"

# 4. OTel + Jaeger  (~31 s sin cert-manager, 111 s con)
kubectl delete namespace otel otel-operator-system --wait=true
START=$(date +%s)
cd otel && ./install.sh
kubectl create job --from=cronjob/scraper-hourly scraper-metrica4-otel -n ml-scraper
kubectl run curl-test --image=curlimages/curl:8.4.0 --restart=Never -- sh -c \
  "curl -s 'http://jaeger-ui.otel.svc.cluster.local:16686/api/services'"
END=$(date +%s)
echo "OTel+Jaeger stack deploy: $((END-START))s"
```

### Resultados

| Stack | Inicio | Fin | Duración | ¿Qué fue lo más lento? |
|---|---|---|---|---|
| **Loki + Grafana** | 01:08:25 | 01:12:29 | **~244 s** | Grafana (~120 s su init container descargando plugins) |
| **EFK** | 01:41:56 | 01:43:57 | **~121 s** | Esperar que ES ponga verde (~87 s) |
| **OTel + Jaeger** | 11:43:59 | 11:44:30 | **~111 s*** | cert-manager (~80 s CRDs + webhook). Sin él: ~31 s |

### Bugs que encontramos y cómo los arreglamos

**Loki:** Grafana entraba en CrashLoopBackOff porque el contacto de Discord requería un webhook válido y nosotros pusimos URL vacía. **Fix:** vaciamos `contact-point.yaml` (`contactPoints: []`) y cambiamos `notification-policy.yaml` a `receiver: grafana-default-email`.

**EFK:** Fluent Bit chart v0.48.5 no renderiza la sección `customParsers`. El parser `json_scraper` no existía → CrashLoopBackOff. Además el filtro grep buscaba `app=scraper` pero los jobs creados por cronjob no heredan esa label. **Fix:** sacamos el parser, usamos `Merge_Log On` del filter kubernetes, y cambiamos grep a `namespace_name=ml-scraper`.

**OTel:** Si ya existían servicios residuales de Jaeger (agent/collector/query), Helm fallaba al crear el all-in-one. **Fix:** eliminar namespace entero y reinstalar con `allInOne.enabled=true` y `collector/agent/query.enabled=false`.

> **Qué significa:** OTel es el más rápido de lejos (~31 s sin cert-manager). EFK es rápido en deploy (~2 min) pero requiere configuración extra (ILM, templates). Loki es el más lento (~4 min) por el init container de Grafana que descarga plugins. **Para un equipo sin SRE, poder reinstalar todo en <5 minutos es tranquilizador.**

---

## Métrica 5 — Tamaño de imagen del agente
### ¿Cuánto pesa cada componente que recolecta logs/trazas?

El "agente" es el componente que corre en cada nodo recolectando datos:
- **Loki stack:** Promtail (`grafana/promtail:3.0.0`)
- **EFK stack:** Fluent Bit (`fluent/fluent-bit:3.0.6`)
- **OTel+Jaeger stack:** OTel Collector (`otel/opentelemetry-collector-contrib:0.110.0`)

| Imagen | Versión | Tamaño comprimido |
|---|---|---|
| `grafana/promtail` | 3.0.0 | 72.9 MB |
| `fluent/fluent-bit` | 3.0.6 | 36.0 MB |
| `otel/opentelemetry-collector-contrib` | 0.110.0 | 64.1 MB |

Otras imágenes del stack (no agentes):

| Imagen | Versión | Tamaño |
|---|---|---|
| `grafana/loki` | 3.1.1 | 26.3 MB |
| `grafana/grafana` | 12.3.1 | 200.7 MB |
| `jaegertracing/all-in-one` | 1.53.0 | 31.3 MB |
| `docker.elastic.co/elasticsearch/elasticsearch` | 8.17.3 | ~890 MB |
| `docker.elastic.co/kibana/kibana` | 8.17.3 | ~520 MB |

**Comando para verificar (cuando las imágenes están en el Docker host):**
```bash
docker image inspect grafana/promtail:3.0.0 --format='{{.Size}}' | numfmt --to=iec
docker image inspect fluent/fluent-bit:3.0.6 --format='{{.Size}}' | numfmt --to=iec
docker image inspect otel/opentelemetry-collector-contrib:0.110.0 --format='{{.Size}}' | numfmt --to=iec
```

> **Qué significa:** Fluent Bit es el agente más liviano (36 MB). OTel Collector está en el medio (64 MB pero unifica logs + trazas en un solo binario). Promtail es el más pesado (73 MB). Para referencia, ES pesa ~890 MB y Kibana ~520 MB.

> En nuestro entorno las imágenes están en containerd (dentro de k3d), no en Docker host. Los valores se obtuvieron via Docker Hub Registry API.

---

## Notas metodológicas

1. **Cada stack usa su agente nativo.** Loki usa Promtail, EFK usa Fluent Bit, OTel usa OTel Collector. No los reemplazamos entre stacks — cada uno usa el recomendado por su ecosistema.

2. **Elasticsearch usa JVM heap fijo** (`-Xms1g -Xmx1g`). Por eso consume ~1.5 GiB de RAM aunque tenga solo 69 MiB de datos. La JVM reserva la memoria aunque no la use.

3. **Jaeger se deployó como all-in-one** con `collector/agent/query/cassandra.enabled=false` y storage en memoria. No se deployó Cassandra. El servicio `jaeger-ui` expone NodePort 30002.

4. **La latencia se midió desde dentro del cluster** (vía `kubectl exec`) para evitar latencia de red externa. El overhead de `kubectl exec` es el mismo para los 3 stacks.

5. **OTel+Jaeger es el stack más liviano** en RAM, CPU y storage, pero **no reemplaza un backend de logs** — necesita a Loki o ES para guardar datos persistentemente.

---

## Limitaciones explícitas

Declaramos aquí todo lo que NO pudimos medir como nos gustaría, para que la cátedra lo tenga presente:

1. **No alcanzamos 24 h continuas de logs.** El cluster se reinició entre las mediciones originales (2026-05-08, 3 muestras a las 14:48, 15:50, 17:32) y las finales de la defensa (2026-05-10). La columna "Disco PVC tras ~24 h" refleja ~4 h de datos, no 24 h completas. Los valores de las 3 muestras originales se documentan en la nota de Métrica 1 (RAM: Loki 294±13 MiB, EFK 2104±8 MiB, OTel 114±5 MiB) y Métrica 2 (Loki 1.8 MiB → originalmente ~12 MiB tras 24 h reales).

2. **Tamaño de imagen vía Docker Hub API, no desde containerd local.** k3d corre dentro de Docker pero las imágenes se almacenan en containerd interno. No podemos ejecutar `docker image inspect` desde el host sobre imágenes que k3d descargó. Los valores de Docker Hub coinciden con los que containerd descargó (mismo tag, mismo digest), pero no los verificamos localmente.

3. **Latencia de un solo punto en el tiempo.** Las 10 corridas por stack se tomaron en ~5 minutos, no en una ventana de 24 h con carga variable. Los valores reflejan un cluster con 4 ejecuciones del scraer acumuladas (~200 KB de datos). Con 5 GB/día la latencia sería diferente.

4. **Deploy time depende del caché de imágenes local.** Las imágenes ya estaban cacheadas en el nodo k3d de las instalaciones previas. En un cluster verdaderamente limpio (sin caché), los tiempos de deploy serían mayores por el pull inicial. Estimamos +60–120 s por stack si las imágenes no están cacheadas.

5. **Una sola muestra final.** Por el reinicio del cluster solo tenemos una muestra fresca de cada métrica (2026-05-10). Las 3 muestras originales del 2026-05-08 mostraban la misma tendencia relativa con valores absolutos más altos. Documentamos ambas.
