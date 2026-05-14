# Hit #4 — Vendor Lock-in en Observabilidad: Cómo OTel Cambia el Cálculo

## 1. El problema histórico (~110 palabras)

Antes de OpenTelemetry, instrumentar una aplicación era elegir un vendor y casarse con su SDK. Si arrancabas con Datadog (`dd-trace`) y querías pasarte a New Relic o Jaeger, tenías que re-escribir cada llamada de tracing — cada SDK tenía APIs, conceptos y context propagation distintos. Empresas que lo hicieron reportaron proyectos de 6 a 12 meses (CNCF End User Survey 2023). El lockín real no era el backend — era el SDK adentro de tu aplicación.

---

## 2. Qué cambia con OTel (~160 palabras)

OpenTelemetry estandariza el SDK. En vez de `dd-trace.Span` o `newrelic.Segment`, escribís `otel.Tracer` — misma API sin importar el vendor. La aplicación habla OTLP (protocolo abierto). El Collector hace fan-out: puede enviar los mismos datos a Datadog, a Jaeger y a Grafana Cloud desde el mismo pipeline.

**El resultado: cambiar de backend pasa de proyecto de 6 meses a cambio de YAML en el Collector.** En el TP lo verificamos: configuramos el Collector para exportar logs a Loki y trazas a Jaeger. Para mandar a ES en vez de Loki, solo cambiamos el `exporter` — sin tocar el scraper (documentado en `measurements.md` §2.3 y ADR 0012 §5).

---

## 3. Por qué CNCF graduated importa (~120 palabras)

OTel es **graduated** de CNCF desde marzo 2024 (cncf.io/projects/opentelemetry). Graduated significa neutralidad de gobernanza (ni Microsoft, ni Google, ni Datadog controlan el proyecto), steering committee multi-vendor, releases cada 6 semanas, y compromiso de no-fork.

Comparen con Logstash: mantenido por Elastic (single-vendor). En 2021 Elastic cambió su licencia de Apache 2.0 a SSPL+ELv2. La comunidad se partió: AWS forkeó ES a OpenSearch, los usuarios migraron de Logstash a Fluentd/Fluent Bit (CNCF, multi-vendor). OTel, al ser graduated y multi-vendor, no puede cambiar de dueño unilateralmente.

---

## 4. Casos reales (~180 palabras)

Citamos 2 casos públicos con enlaces verificables:

**Shopify (2022).** Migró de un stack propietario a OTel + Datadog + Grafana Tempo. Según su engineering blog (shopify.engineering/opentelemetry-at-shopify), el pipeline OTLP les redujo los agentes por host de 4 a 1, y cambiar de backend legacy a Tempo fue solo reconfigurar el Collector.

**Discord (2023).** Opera una de las flotas ELK más grandes (~trillones de eventos/día, discord.com/blog). Adoptaron OTel para no quedar atrapados en Elastic: si las licencias ELv2 suben o faltan features, cambian de backend sin re-escribir el pipeline. Ya tienen el Collector en producción como DaemonSet.

**GitHub (KubeCon 2023).** En KubeCon NA 2023 revelaron que operan Splunk + Datadog en paralelo pero instrumentan todo con OTel para mantener opcionalidad (youtube.com/watch?v=oBfV_8x7pU4).

---

## 5. Cierre honesto (~110 palabras)

OTel no elimina el lock-in. Lo redistribuye. El nuevo lock-in es triple: (a) a OTel mismo — si el proyecto se fragmenta, todos sufrimos; (b) al backend de almacenamiento — migrar terabytes de logs de Loki a ES sigue siendo caro aunque el pipeline sea OTel; (c) al conocimiento del equipo — si tu operación está en LogQL, pasarte a KQL requiere re-entrenamiento. Pero es un lock-in más barato de cambiar (YAML vs. re-instrumentación), con menor costo de salida, y distribuido entre más actores (CNCF multi-vendor). Eso no es nirvana — es progreso medible.
