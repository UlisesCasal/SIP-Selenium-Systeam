# EFK Stack para Scraper Logs

Stack completo de observabilidad para los logs del scraper de MercadoLibre: Elasticsearch, Fluent Bit y Kibana (EFK) sobre **ECK** (Elastic Cloud on Kubernetes).

## Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
│                                                             │
│  ┌───────────┐     ┌───────────────┐     ┌──────────────┐  │
│  │ Fluent Bit │────▶│ Elasticsearch │◀────│    Kibana    │  │
│  │ (DaemonSet)│     │   (Single)    │     │  (NodePort)  │  │
│  └───────────┘     └───────────────┘     └──────────────┘  │
│       ▲                                        │            │
│       │ /var/log/containers/*.log              │ :30001     │
│       │                                        ▼            │
│  ┌─────────┐                            ┌──────────┐       │
│  │ App Pods │                            │ Browser  │       │
│  └─────────┘                            └──────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Versiones (Abril 2026)

| Componente    | Chart / CRD                        | Versión                |
| ------------- | ---------------------------------- | ---------------------- |
| ECK Operator  | `elastic/eck-operator`             | `2.16.1`               |
| Elasticsearch | CRD `elasticsearch.k8s.elastic.co` | `8.17.1`               |
| Kibana        | CRD `kibana.k8s.elastic.co`        | `8.17.1`               |
| Fluent Bit    | `fluent/fluent-bit`                | `0.48.3` (App `3.2.x`) |

## Requisitos previos

- Kubernetes cluster (k3d / Docker Desktop / Rancher Desktop)
- Helm 3.x
- kubectl configurado
- curl

## Instalación rápida

```bash
cd efk
bash install.sh
```

El script es **idempotente**: puede ejecutarse múltiples veces sin problemas.

## Estructura de archivos

```
efk/
├── install.sh                          # Script principal de despliegue
├── helm/
│   ├── eck-operator-values.yaml        # Values para ECK Operator
│   └── fluent-bit-values.yaml          # Values para Fluent Bit DaemonSet
├── manifests/
│   ├── namespace.yaml                  # Namespace elastic
│   ├── elasticsearch.yaml              # CRD Elasticsearch (single-node)
│   ├── kibana.yaml                     # CRD Kibana
│   ├── kibana-nodeport.yaml            # Service NodePort :30001
│   └── ilm-policy.json                 # ILM Policy para retención de logs
├── dashboards/
│   └── scraper-overview.ndjson         # Dashboard pre-configurado
├── queries/
│   └── kql-cookbook.md                  # Queries KQL comunes
└── README.md
```

## Output esperado al final

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅  Stack EFK instalado exitosamente
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Componente           Estado
  ─────────────────    ──────────────
  ✓ ECK Operator        Running
  ✓ Elasticsearch       green
  ✓ Kibana              green
  ✓ Fluent Bit          1/1 pods Ready
  ✓ ILM Policy          'scraper-logs' aplicada
  ✓ Data View           'scraper-*' creado
  ✓ Dashboard           'Scraper Overview' importado

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🌐  Acceso a Kibana
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  URL:       https://<node-ip>:30001
  Usuario:   elastic
  Password:  <recuperado dinámicamente>
```

## Acceso a Kibana

Una vez instalado, acceder a Kibana en `https://<node-ip>:30001`.

Credenciales:

- **Usuario**: `elastic`
- **Password**: Recuperar dinámicamente con:
  ```bash
  kubectl get secret elastic-es-elastic-user -n elastic \
    -o jsonpath='{.data.elastic}' | base64 -d
  ```

## Logs del scraper

Fluent Bit recolecta logs de todos los contenedores vía `/var/log/containers/*.log` y los indexa con prefijo `scraper-*`.

Para logs estructurados, el scraper debe emitir JSON:

```json
{
  "@timestamp": "2026-05-01T12:00:00.000Z",
  "level": "info",
  "message": "Scraping completed for 'bicicleta rodado 29'",
  "product": "bicicleta rodado 29",
  "results": 42,
  "duration": 15.5,
  "browser": "chrome"
}
```

## Queries útiles

Ver `queries/kql-cookbook.md` para queries KQL comunes.

## Dashboard

El dashboard `Scraper Overview` incluye métricas clave:

- Logs por nivel (info/warn/error)
- Rendimiento por producto
- Errores por navegador
- Tendencias temporales

Se importa automáticamente durante `install.sh`. Para reimportar manualmente:

```bash
ES_PASS=$(kubectl get secret elastic-es-elastic-user -n elastic \
  -o jsonpath='{.data.elastic}' | base64 -d)

kubectl port-forward -n elastic svc/kibana-kb-http 5601:5601 &
curl -sk -X POST "https://localhost:5601/api/saved_objects/_import?overwrite=true" \
  -u "elastic:$ES_PASS" \
  -H "kbn-xsrf: true" \
  -F "file=@dashboards/scraper-overview.ndjson"
```

## Limpieza

```bash
helm uninstall fluent-bit -n elastic
helm uninstall eck-operator -n elastic-system
kubectl delete namespace elastic
kubectl delete namespace elastic-system
```
