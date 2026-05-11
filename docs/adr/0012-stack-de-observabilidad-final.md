# 0012 — Stack de observabilidad final para startup OSS-only en K8s

- **Date:** 2026-05-11
- **Status:** Accepted
- **Deciders:** Equipo SIP 2026 (4 devs full-stack)
- **Supersedes:** 0007 (completamente), 0009 (parcialmente — ver §7)

---

> **Para la defensa oral:** este ADR es la respuesta a "¿qué stack eligieron y por qué?".
> Hay 3 ideas fuerza que tienen que quedar claras:
> 1. **No hay stack perfecto** — cada contexto tiene su mejor opción.
> 2. **Nosotros somos una startup chica** — priorizamos bajo consumo de recursos, deploy rápido, y no depender de un ingeniero de plataforma.
> 3. **Elegimos OTel + Loki + Grafana + Jaeger** porque pesa poco, cuesta $0, y si el día de mañana cambia el contexto, podemos migrar sin re-escribir código.

---

## 1. Contexto
### ¿Quiénes somos y qué necesitamos?

Somos **4 desarrolladores full-stack** manteniendo un scraper de MercadoLibre como CronJob en Kubernetes (k3s sobre k3d). Sin SRE, sin equipo de plataforma. Rotamos on-call semanal con PagerDuty free — el que está de guardia es un developer, no un SRE.

**La aplicación:** un scraper Node.js que cada hora busca productos en MercadoLibre, extrae datos con Puppeteer y los guarda en JSON. Corre en una VM de **$40 USD/mes** en AWS (t3a.xlarge: 4 vCPU, 16 GiB RAM). Tras PostgreSQL (1.5 Gi buffer), Redis (512 MiB), y la app (512 MiB), quedan ~**6 GiB libres** para observabilidad. No podemos pedir más VM sin justificarlo al CTO.

**Volumen de logs:** ~500 MB/día de logs JSON estructurados (~6.000 líneas/hora pico) con `level`, `message`, `producto`, `span_id`, `trace_id` — hechos para máquinas, no para grep. Proyectamos ~5 GB/día en 12 meses si agregamos API REST, webhooks y health checks. El scraper también genera trazas OTLP que hoy vemos con Jaeger pero queremos persistir.

**Madurez operativa:** kubectl, Helm 3, GitHub Actions. Sin dashboards, sin alerting, sin tracing. Saben `kubectl logs`, pero con 50 pods rotando por hora los logs se pierden al reciclarse los pods — la terminal deja de ser útil para debugging.

**Restricciones:** sin datos personales ni regulación aplicable (startup pre-seed, sin DPA). El CTO también codea y el budget cabe en una tarjeta corporativa. Cualquier gasto recurrente tiene que defenderse en 2 minutos.

> **Para la defensa:** si te preguntan "¿por qué tanto contexto?", la respuesta es: porque el mejor stack no existe en abstracto. Un stack que es genial para Google es un desastre para 4 devs con $40/mes. Describir bien el contexto es lo que hace que nuestra decisión sea defendible.
>
> **Y ojo:** este escenario no es Google ni MercadoLibre. Es una startup chica donde vos, developer, tenés que convencer a tu CTO de por qué gastar USD 30/mes extra en una VM más grande solo para que Elasticsearch entre. Si no podés defenderlo con números, perdiste el argumento. **Nuestro ADR se defiende con mediciones, no con opiniones.**

---

## 2. Alternativas consideradas
### ¿Qué probamos y qué descartamos?

Evaluamos **5 stacks**: los 3 que desplegamos y medimos en el TP (Loki, EFK, OTel), más 2 que conocemos de la teoría y del Hit #4 de la Parte 1 (Datadog, Splunk). Todos los valores numéricos vienen de nuestras mediciones (`docs/observability-final/measurements.md`).

#### 2.1. Loki + Promtail + Grafana
Stack OSS nativo de K8s. Loki 3.1.1 (single-binary, 5 Gi disco), Promtail 3.0.0 DaemonSet, Grafana 12.3.1. **RAM: 239 MiB** (Loki 161 + Grafana 61 + Promtail 17). Latencia p95: 50 ms. Deploy: 244 s. **Cómo funciona:** indexa labels (namespace, pod, container), **no** el contenido. Para buscar texto adentro, escanea todos los streams de esa label.
- **Ventaja:** $0 licencia, lo opera cualquiera con Helm, liviano.
- **Desventaja:** buscar texto sin label específica requiere escanear secuencialmente. En volumen alto, tarda.

#### 2.2. EFK (Elasticsearch + Fluent Bit + Kibana)
Stack clásico. ES 8.17.3 vía ECK Operator (10 Gi disco, 1 Gi heap JVM fijo), Kibana para UI, Fluent Bit como DaemonSet. **RAM: 2.1 GiB** (ES 1.545 + Kibana 554). Latencia p95: 85 ms. Deploy: 121 s. **Cómo funciona:** al revés que Loki — ES indexa el contenido completo de cada log (índices invertidos). Buscar cualquier palabra es instantáneo como Google.
- **Ventaja:** full-text rapidísimo. Ideal para debugging cuando no sabés exactamente qué buscar.
- **Desventaja:** 8× más RAM que Loki. La JVM reserva 1 Gi aunque tenga 0 datos. Licencia ELv2 restrictiva (funcionalidades de seguridad pasaron a ser pagas). Tunear JVM no sabemos hacerlo.

#### 2.3. OpenTelemetry Collector + Loki + Jaeger
Stack híbrido. OTel Collector Contrib 0.110.0 como DaemonSet recibe logs y trazas en OTLP y los reenvía al backend que configures. **RAM: 115 MiB** (Collector 89 + Jaeger 26). Latencia p95: 61 ms. Deploy: ~31 s. **Cómo funciona:** es un "router universal" de telemetría — recibe datos en formato estándar OTLP y los manda a donde quieras. Hoy a Loki (logs) y Jaeger (trazas), mañana a Elasticsearch o Datadog solo cambiando el exporter.
- **Ventaja:** un solo agente para logs y trazas (antes: Promtail + Fluent Bit + agente de traces). Imagen 64 MB, deploy ~31 s.
- **Desventaja:** no almacena — es pipeline, no backend. Jaeger en memoria pierde todo al reiniciar.

#### 2.4. Datadog Logs (managed SaaS)
SaaS todo-en-uno (~$15/host/mes + ~$1/GB ingest; ~$200–300/mes para 3 nodos). No lo desplegamos — quintuplica nuestro budget cloud. **Pro:** zero ops, 600+ integraciones, correlación logs↔trazas automática. **Contra:** lock-in severo (APIs propias, no OTel nativas); migrar fuera requiere re-instrumentar. Descartado por precio. Candidato natural si el presupuesto crece (ver §6).

#### 2.5. Splunk Cloud
SaaS/on-prem con foco en SIEM (~USD 2–5/GB/día, desde USD 2.000/año). No hace APM como Datadog — es SIEM puro. **Pro:** estándar en banca y salud, audit trail nativo, retención 7+ años. **Contra:** SPL es otro lenguaje a aprender, forwarder ~200 MB, fuera de presupuesto. Descartado — no tenemos requisitos regulatorios.

---

## 3. Decisión
### ¿Qué elegimos y por qué?

> **Adoptamos OTel Collector como pipeline único + Loki para logs + Grafana para visualizar + Jaeger all-in-one para trazas, con plan de migrar a Tempo en 12 meses.**

**1. Consumo de recursos — el que más pesa en la defensa.** El stack combinado ocupa ~350 MiB RAM. EFK solo 2.1 GiB. En nuestra VM de $40/mes, 1.7 GiB de diferencia define si PostgreSQL anda con buen buffer pool o tenemos que elegir entre DB y logs. **"¿Por qué no EFK?" — porque come 8× más RAM y no tenemos de sobra.**

**2. Deploy rápido.** Cualquier developer reinstala todo en <5 minutos. OTel ~31 s, Loki ~4 min. EFK ~2 min + ILM + templates + passwords que cambian. **Sin SRE, que un developer reinstale sin leer documentación es clave.**

**3. OTel desacopla instrumentación del backend.** Hoy mandamos a Loki. Si necesitamos full-text, cambiamos el exporter sin tocar el scraper. **Nuestra decisión no es un callejón sin salida.**

**¿Cuándo cambiaría esta decisión?**
- Si el presupuesto mensual supera USD 2.000 → Datadog, zero ops.
- Si el equipo crece a 10+ personas y necesitan full-text search pesado → EFK.
- Si entramos en banca/salud → Splunk (es el estándar y tiene audit trail).

---

## 4. Trade-offs aceptados explícitos
### ¿A qué renunciamos con esta decisión?

Aceptamos 5 renuncias. Cada una con su mitigación.

#### 1. Renunciamos a búsqueda rápida por contenido
Loki busca por labels, no por texto. Sin label para producto, escanea todos los streams.
**Mitigación:** logs JSON con campos `producto` y `level`. La mayoría de búsquedas se resuelven con labels. Si necesitamos full-text, agregamos ES como backend secundario — con OTel, solo cambiamos un exporter.

#### 2. Aceptamos que Loki es single-instance
Un pod Loki con un disco. Si el pod muere y el disco se corrompe, perdemos logs.
**Mitigación:** snapshots semanales vía CronJob. `kubectl logs --previous` como fallback. En k3s pre-seed, la probabilidad de corrupción es baja.

#### 3. Jaeger pierde traces al reiniciar
Jaeger all-in-one usa memoria. Pod muerto = traces perdidos.
**Mitigación:** el scraper corre cada hora y genera traces nuevos cada vez. Para debugging ejecutamos el job manual. Si necesitamos persistencia, conectamos Jaeger a ES.

#### 4. Sin correlación automática logs↔traces
En Datadog, un clic en un trace muestra los logs asociados. Nosotros buscamos traceID en Loki a mano.
**Mitigación:** cada log JSON ya incluye `trace_id` y `span_id`. En 6 meses evaluamos Tempo, que integra traces con Loki nativamente.

#### 5. Riesgo de lock-in en Grafana
Los dashboards son JSON propietario. Cambiar de UI requiere redibujar.
**Mitigación:** dashboards como código en Git. Importables en cualquier Grafana (incluso Grafana Cloud). Lock-in de datos, no de trabajo perdido.

---

## 5. Evidencia empírica (Hit #1)
### ¿Qué dicen los números?

Mediciones completas en `docs/observability-final/measurements.md`. Esta tabla resume:

| Métrica | Loki + Grafana | EFK | OTel + Jaeger |
|---|---|---|---|
| RAM total (MiB) | 239 | 2.099 | 115 |
| CPU total (mCPU) | 30 | 287 | 38 |
| Disco usado (MiB) | 1,8 | 69 | 0 |
| Query latency p50 (ms) | 19 | 56 | 52 |
| Deploy clean (s) | 244 | 121 | ~31 |

1. **EFK consume 2.099 MiB RAM vs 239 MiB de Loki — 9× más.** En nuestra VM de $40/mes, eso es ~$30/mes extra solo para mantener ES vivo. El 10% de nuestro presupuesto cloud.

2. **Latencia Loki p95 = 50 ms, muy por debajo de nuestro target de 2 s.** Los 3 stacks cumplen. La latencia no decide la elección.

3. **OTel deploya en ~31 s, Loki en 244 s, EFK en 121 s + configuración.** En las 3 veces que reinstalamos por namespaces trabados, la diferencia entre 30 s y 8 min fue enorme.

---

## 6. Plan de evolución
### ¿Qué hacemos cuando el contexto cambie?

Definimos 3 horizontes con trigger, acción y riesgo.

#### 6 meses — Tempo para traces persistentes
**Trigger:** 2 GB/día sostenidos o equipo crece a 6+ developers (más debugging y Jaeger en memoria no alcanza).
**Acción:** reemplazar Jaeger all-in-one por Grafana Tempo. El pipeline OTLP ya existe — solo cambiar el endpoint del exporter en el Collector.
**Riesgo:** el equipo vuelve a debuggear con `kubectl logs`. Productividad de debugging cae ~30%.

#### 12 meses — Elasticsearch para full-text
**Trigger:** superamos 5 GB/día de logs o LogQL `|=` se vuelve lento (hoy 50 ms; a 5 GB/día serían ~500 ms).
**Acción:** agregar ES como backend secundario. El mismo Collector exporta a Loki (label-based) y a ES (full-text) en paralelo. Kibana solo para búsquedas pesadas.
**Riesgo:** el equipo ignora logs por lentitud. La observabilidad deja de usarse.

#### 24 meses — Datadog o Grafana Cloud
**Trigger:** Serie A, equipo 15+ personas, presupuesto cloud pasa a USD 5.000–10.000/mes. Aparece un equipo de plataforma.
**Acción:** migrar a Datadog (zero ops) o Grafana Cloud (mismo stack OTel, sin operar nada). Con OTel, solo cambiar el endpoint del exporter.
**Riesgo:** el equipo de plataforma gasta ~0.5 FTE operando Loki+ES+Tempo cuando podría estar resolviendo problemas de producto.

---

## 7. Relación con ADRs previos
### ¿Qué cambiamos respecto a decisiones anteriores?

- **ADR 0007 (Loki + Promtail + Grafana):** lo reemplazamos. Loki+Grafana se mantienen como base, pero OTel Collector ahora es el agente en lugar de Promtail, y sumamos Jaeger para trazas.
- **ADR 0009 (Evaluación de EFK):** lo actualizamos. EFK ya no es candidato a stack único — pasa a ser backend secundario para full-text search cuando el volumen lo justifique.
- **ADR 0010 (Instrumentación OTel):** lo confirmamos. ADR 0010 explica por qué OTel unifica la recolección. Este ADR 0012 elige el backend final (Loki + Jaeger) sobre esa capa.

---

## 8. Referencias

- Mediciones: `docs/observability-final/measurements.md`
- Matriz de decisión: `docs/observability-final/decision-matrix.md`
- Vendor lock-in essay: `docs/observability-final/vendor-lockin-essay.md`
- ADR 0004: `docs/adr/0004-estrategia-de-logs.md`
- ADR 0007: `docs/adr/0007-stack-de-logging.md`
- ADR 0009: `docs/adr/0009-stack-de-logging-efk.md`
- ADR 0010: `docs/adr/0010-instrumentacion-vendor-neutral.md`
- CNCF Observability Whitepaper: https://github.com/cncf/tag-observability/blob/main/whitepaper.md
- Charity Majors et al., *Observability Engineering* (O'Reilly, 2022) — Cap. 3 y 7
- Cindy Sridharan, *Distributed Systems Observability* (O'Reilly, 2018)
- Ford, Richards, Sadalage, Dehghani, *Software Architecture: The Hard Parts* (O'Reilly, 2021) — Cap. 7
- OpenTelemetry: https://opentelemetry.io/docs/
- Loki Architecture: https://grafana.com/docs/loki/latest/get-started/architecture/
- Elastic License v2: https://www.elastic.co/licensing/elastic-license
- Grafana Tempo: https://grafana.com/oss/tempo/
