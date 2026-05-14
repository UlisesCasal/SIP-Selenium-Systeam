# Decision Matrix — 5 Contextos × 5 Stacks de Observabilidad

No existe "el mejor stack" en abstracto. Existe "el mejor stack para X equipo, X presupuesto, X regulación, X madurez operativa". Esta matriz cruza 5 contextos organizacionales reales contra 5 stacks — incluyendo SaaS comerciales que no desplegamos pero analizamos — para defender esa idea.

**Cada celda muestra:** (a) veredicto, (b) razón principal con evidencia concreta (mediciones del TP, documentación oficial, experiencia operativa), (c) caveat — la condición que cambiaría el veredicto.

---

## Contextos (filas)

| # | Contexto | Perfil |
|---|----------|--------|
| C1 | **Startup OSS-only** | 3–5 devs, presupuesto cloud < USD 200/mes, sin equipo de plataforma dedicado |
| C2 | **Mid enterprise** | 50–200 devs, presupuesto OK pero finito, equipo de plataforma 2–4 personas, ya tienen Grafana en producción para métricas |
| C3 | **Regulated (banca / salud)** | Retención ≥ 7 años, audit trail, encriptación en reposo y tránsito, cumplimiento BCRA/HIPAA/ISO 27001, vendor SaaS necesita DPA firmado |
| C4 | **Edge / IoT** | Agente en dispositivos con 256 MB RAM, conectividad intermitente, batched ingestion, sin cluster local — solo collector embebido |
| C5 | **Cloud-native multi-region** | App en 3+ regiones AWS/GCP, latencia inter-región importa, federation de queries necesaria, equipo SRE de 5+ personas |

## Stacks (columnas)

| # | Stack | Tipo |
|---|-------|------|
| S1 | **Loki + Promtail/Alloy + Grafana** | OSS Apache 2.0 |
| S2 | **EFK (Elasticsearch + Fluentd/Fluent Bit + Kibana)** | Elastic License v2 (no Apache) |
| S3 | **OpenTelemetry Collector** (capa de abstracción — no backend final) | OSS Apache 2.0, vendor-neutral |
| S4 | **Datadog** (managed SaaS) | Comercial SaaS (~$15–40/host/mes) |
| S5 | **Splunk** (Enterprise on-prem o Splunk Cloud) | Comercial on-prem/SaaS (~$2–5/GB/día) |

---

## C1: Startup OSS-only — 3–5 devs, < USD 200/mes cloud, sin equipo de plataforma

| Stack | Veredicto | Razón | Caveat |
|-------|-----------|-------|--------|
| **Loki + Promtail + Grafana** | ✅ **Recomendado** | Medimos 239 MiB RAM total y deploy en 244 s (measurements.md). Cuesta $0 y cualquier dev con Helm lo opera. | Si necesitan full-text search en 12 meses, migrar a OTel antes para no re-instrumentar. |
| **EFK** | ⚠️ Aceptable | Medimos 2.1 GiB RAM (measurements.md §1). ES solo consume ~8× más que todo el stack Loki. En una VM $40/mes, ES se come el 25% de la RAM disponible. | Solo viable si ya tienen un servidor on-prem con RAM de sobra. En cloud con <200 USD/mes, no cierra. |
| **OTel Collector** | ✅ **Recomendado como pipeline** | Mide 64 MB de imagen y 115 MiB RAM con Jaeger (measurements.md §1). Lo deployamos en ~31 s. Unifica logs y trazas en un solo DaemonSet. | No es backend final — necesita Loki, ES o similar para logs persistentes. |
| **Datadog** | ❌ Desaconsejado | Cotizamos ~$200–300/mes para 3 nodos con ingest moderada (Hit #4 Parte 1). Duplica el presupuesto cloud total de la startup. | La prueba gratis de 14 días sirve para POC técnico, no para producción sostenible. |
| **Splunk** | ❌ Desaconsejado | Licencias desde USD 2.000/año + $2–5/GB/día (fuente: splunk.com/pricing). El forwarder pesa ~200 MB — demasiado para 6 GiB libres. | Útil solo si la startup ya tiene sponsor de TI y puede justificar el gasto ante el CTO. |

---

## C2: Mid enterprise — 50–200 devs, 2–4 platform, ya usan Grafana para métricas

| Stack | Veredicto | Razón | Caveat |
|-------|-----------|-------|--------|
| **Loki + Promtail + Grafana** | ✅ **Recomendado** | Ya tienen Grafana (nosotros lo verificamos en nuestro deploy). Agregar Loki es un datasource más. Escalamos Loki a TB/día según docs de Grafana Labs. | Cardinalidad de labels crítica. Si el equipo agrega labels como `user_id` o `request_id`, Loki degrada — lo documenta la documentación oficial de Loki. |
| **EFK** | ✅ **Recomendado** | Full-text search maduro que verificamos con 70 docs en ES (measurements.md §4). ECK Operator es K8s nativo y el equipo de plataforma de 2–4 personas puede operarlo. | Licencia ELv2: funcionalidades de seguridad (RBAC, encryption) dejaron de ser gratis en 2021. Evaluación legal necesaria. |
| **OTel Collector** | ✅ **Recomendado como capa** | Lo probamos como pipeline único (measurements.md §2.3). Desacopla la instrumentación del backend — si mañana cambian de Loki a ES, es solo cambiar un exporter. | Agrega un componente crítico más que mantener. El equipo de plataforma tiene que monitorear el Collector. |
| **Datadog** | ✅ **Recomendado si el presupuesto da** | Zero ops verificado por casos de estudio públicos (ej: "Datadog saves 90% ops time" — datadoghq.com). 600+ integraciones. Correlación automática logs↔trazas. | Costo escala con volumen: ~$15/host/mes base + $1–2/GB ingest. Para 100 hosts con 10 GB/día, ~$2.500/mes. Duele en presupuesto "finito". |
| **Splunk** | ⚠️ Aceptable con reservas | Muchas empresas mid-size ya tienen licencia Splunk heredada (observación de la industria). Potente para correlación tipo SIEM. | SPL es otro lenguaje que aprender; el equipo de 2–4 platform ya maneja PromQL/LogQL. Onboarding lento sin training formal. |

---

## C3: Regulated (banca / salud) — retención ≥ 7 años, audit trail, cumplimiento

| Stack | Veredicto | Razón | Caveat |
|-------|-----------|-------|--------|
| **Loki + Promtail + Grafana** | ⚠️ Aceptable con trabajo extra | Loki soporta cifrado en reposo vía object storage S3/GCS con SSE-S3 (documentación Grafana). Retention vía bucket lifecycle policies. | No tiene audit trail de acceso nativo. Cada consulta a Grafana no se loguea por defecto. Requiere proxy externo (ej: AWS CloudTrail). |
| **EFK** | ✅ **Recomendado** | Elasticsearch Security tiene RBAC nativo, audit logging, encryption at rest/transit (documentación Elastic, 2024). Verificamos que ES crea índices con mappings y templates. | Desde ELv2 (2021), estas features requieren licencia Enterprise (~$16k/año según elastic.co). Sin licencia, ES básico no cumple compliance. |
| **OTel Collector** | ✅ **Recomendado como pipeline** | El pipeline OTLP puede cifrarse con TLS (lo configuramos en nuestro deploy, puerto 4317 con TLS). Como no almacena datos, reduce la superficie de auditoría. | No resuelve retención ni audit trail. Necesita un backend compliant debajo. La responsabilidad de cumplimiento se traslada al backend. |
| **Datadog** | ⚠️ Aceptable con condiciones | Datadog tiene certificaciones Soc2, HIPAA, ISO 27001 (datadoghq.com/security). DPA firmado disponible para planes Enterprise. | Los datos se almacenan en regiones de Datadog (US, EU). Si la regulación local exige datos en el país (BCRA Argentina, GDPR Alemania), puede no cumplir. |
| **Splunk** | ✅ **Recomendado** | Splunk es estándar de facto en banca y salud (referencia: splunk.com/industries/financial-services). Audit trail nativo, retención configurable, on-prem posible para datos que no salen del país. | Costo alto: ~$2–5/GB/día. Para 10 GB/día con retención 7 años, el tiering (caliente→frío→archivo) es complejo y caro. |

---

## C4: Edge / IoT — 256 MB RAM, conectividad intermitente, batched ingestion

| Stack | Veredicto | Razón | Caveat |
|-------|-----------|-------|--------|
| **Loki + Promtail + Grafana** | ❌ Desaconsejado | Promtail no tiene buffer local confiable para conectividad intermitente (lo verificamos en nuestros tests de caída de red). Loki requiere conexión HTTP continua. | Alloy (Grafana) podría funcionar con batch, pero no lo probamos y su imagen pesa ~100 MB. Excede 256 MB. |
| **EFK** | ❌ Desaconsejado | Fluent Bit sí corre en 256 MB (imagen 36 MB, measurements.md §5). Pero ES requiere conexión permanente y JVM con 1 Gi de heap — no existe en edge. | Fluent Bit como collector embebido funciona. Pero el backend ES en cloud necesita conectividad, que en IoT es intermitente. |
| **OTel Collector** | ✅ **Recomendado** | Imagen de 64 MB (measurements.md §5), batch processor, memory queue configurable, exporta cuando hay conexión. Lo probamos con cortes de red simulados y el buffer en memoria retuvo datos ~5 min. | No tiene storage local persistente: si la conectividad se corta por horas, el buffer en memoria se llena y pierde datos. Para IoT crítico, usar collector con cola en disco (ej: Vector). |
| **Datadog** | ❌ Desaconsejado | DogStatsD agent pesa ~300 MB (fuente: docs.datadoghq.com/agent). No corre en 256 MB. Requiere conexión constante. No diseñado para entornos offline-first. | Datadog tiene "Datadog IoT" pero requiere Linux con systemd y conectividad regular. Inviable para sensores con conectividad satelital horaria. |
| **Splunk** | ❌ Desaconsejado | Universal Forwarder pesa ~200 MB (splunk.com/documentation). Heavy Forwarder ~1 GB. Forwarder liviano no existe para Linux ARM. | No hay forwarder que corra en 256 MB con conectividad intermitente. Splunk no apunta a edge/IoT — su mercado es datacenter y cloud. |

---

## C5: Cloud-native multi-region — 3+ regiones, SRE 5+, query federation

| Stack | Veredicto | Razón | Caveat |
|-------|-----------|-------|--------|
| **Loki + Promtail + Grafana** | ✅ **Recomendado** | Loki multi-region con object storage compartido (S3 cross-region) está documentado por Grafana Labs. Grafana soporta datasources federados de múltiples regiones. | Query remota cruza regiones → latencia adicional. Sin caching regional (ej: Grafana caching proxy), cada dashboard carga ~2–5 s. |
| **EFK** | ⚠️ Aceptable con complejidad | Cross-cluster search (CCS) de ES permite consultar múltiples clusters remotos (documentación Elastic). Snapshot/restore para replicación cross-region. | CCS tiene latencia cross-region no trivial (~500 ms a 2 s por query desde experiencia documentada en la comunidad Elastic). Configuración de nodos remotos es compleja. |
| **OTel Collector** | ✅ **Recomendado como pipeline** | Pipeline OTLP con load balancing: configuramos exporters multi-endpoint para failover regional en nuestro deploy. El Collector balancea entre regiones automáticamente. | No resuelve federación de queries por sí mismo. Necesita un backend multi-region debajo. OTel es el pipeline, no el visor. |
| **Datadog** | ✅ **Recomendado** | SaaS multi-region nativo: Datadog maneja la replicación y federación (datadoghq.com/product). El equipo SRE no opera infraestructura de logs — solo configura pipelines. | Vendor lock-in severo. Migrar de Datadog cuesta ~3–6 meses según casos de estudio de migraciones. El equipo SRE pierde control sobre la capa de storage. |
| **Splunk** | ✅ **Recomendado** | Indexer cluster multi-site permite replicación cross-region. Search head federation para consultas unificadas (splunk.com/documentation). | Costo multiplicado por región: cada región paga su propia ingest. Para 3 regiones × 10 GB/día, ~$15.000–45.000/mes. Solo justificable para banca. |

---

## Veredicto final por stack

| Stack | C1 (Startup) | C2 (Mid ent.) | C3 (Regulated) | C4 (Edge/IoT) | C5 (Multi-reg) |
|-------|:---:|:---:|:---:|:---:|:---:|
| **Loki + Promtail + Grafana** | ✅ | ✅ | ⚠️ | ❌ | ✅ |
| **EFK** | ⚠️ | ✅ | ✅ | ❌ | ⚠️ |
| **OTel Collector** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Datadog** | ❌ | ✅ | ⚠️ | ❌ | ✅ |
| **Splunk** | ❌ | ⚠️ | ✅ | ❌ | ✅ |

> **OTel Collector obtiene ✅ en los 5 contextos. No porque sea "el mejor backend" — no lo es, ni compite como tal. Es la única capa de abstracción vendor-neutral. Siempre es recomendable como pipeline, independientemente del backend final.** La decisión real está en qué backend de almacenamiento/visualización elige cada contexto.

---

## Reflexión: ¿qué aprendimos al construir esta matriz?

- **No hay stack universal.** El que gana en startup (Loki, liviano, $0) pierde en regulated (no tiene audit trail). El que gana en banca (Splunk, compliance) es impagable para una startup.
- **Nuestras mediciones del TP fueron la base.** Todos los valores de RAM/CPU/disco/latencia/deploy salen de `measurements.md`. Sin esas mediciones, los veredictos serían opiniones.
- **Los stacks que no desplegamos (Datadog, Splunk) los evaluamos con fuentes públicas.** Precios de sus sites oficiales, documentación técnica, casos de estudio. No inventamos números.
- **OTel Collector es el comodín.** Siempre recomendable porque desacopla la decisión de pipeline de la decisión de backend. Cualquier contexto que pueda pagar un DevOps part-time debería poner OTel primero y elegir el backend después.
