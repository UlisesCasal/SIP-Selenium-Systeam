# SD-2026 — SIP Selenium Systeam

## Guía de Comandos

### 1. Preparación del Clúster

```bash
k3d cluster create sobel --servers 1 --agents 2 -p "30002:30002@server:0"

kubectl create namespace ml-scraper
kubectl create namespace otel
kubectl create namespace observability
kubectl create namespace elastic
kubectl create namespace elastic-system
```

### 2. Infraestructura y Almacenamiento

```bash
kubectl apply -f HIT7/k8s/pvc.yaml
kubectl -n ml-scraper get pvc
```

### 3. Build y Despliegue del Scraper

```bash
docker build -t ml-scraper:otel-v24 .
k3d image import ml-scraper:otel-v24 -c sobel

kubectl apply -f HIT7/k8s/cronjob.yaml
kubectl apply -f HIT7/k8s/configmap.yaml
```

### 4. Observabilidad

#### EFK (Elasticsearch + Fluent Bit + Kibana)

```bash
cd efk
chmod +x install.sh
./install.sh
# Kibana en https://localhost:30001
```

#### Loki + Promtail + Grafana

```bash
cd observability
chmod +x install.sh
./install.sh
# Grafana en http://localhost:30000 (admin/prom-operator)
```

#### OpenTelemetry Collector + Jaeger

```bash
cd otel
chmod +x install.sh
./install.sh

# Jaeger UI
kubectl port-forward -n otel svc/jaeger-ui 30002:16686
# Abrir http://localhost:30002
```

### 5. HIT8 — PostgreSQL

```bash
kubectl apply -f HIT8/k8s/postgres-secret.yaml
kubectl apply -f HIT8/k8s/postgres-pvc.yaml
kubectl apply -f HIT8/k8s/postgres-service.yaml
kubectl apply -f HIT8/k8s/postgres-statefulset.yaml
kubectl apply -f HIT8/k8s/migrations-configmap.yaml
kubectl apply -f HIT8/k8s/configmap.yaml
kubectl apply -f HIT8/k8s/cronjob.yaml
```

### 6. Pruebas y Troubleshooting

```bash
# Correr scraper manual
kubectl -n ml-scraper create job --from=cronjob/scraper-hourly scraper-test-manual

# Ver pods y logs
kubectl -n ml-scraper get pods
kubectl -n ml-scraper logs -f job/scraper-test-manual

# Diagnóstico
kubectl -n ml-scraper describe pod <nombre-del-pod>

# Logs del collector
kubectl -n otel logs daemonset/agent-collector --tail=50

# Ver trazas en Jaeger via API
curl "http://localhost:16686/api/services"
curl "http://localhost:16686/api/traces?service=scraper-mercadolibre&limit=5"
```

### Namespaces

| Namespace | Contenido |
|-----------|-----------|
| `ml-scraper` | CronJob scraper, ConfigMaps, PVC |
| `sip-selenium` | HIT8: PostgreSQL, cronjob |
| `observability` | Loki, Promtail, Grafana |
| `elastic` | ES, Kibana, Fluent Bit |
| `otel` | OTel Collector, Jaeger |
| `elastic-system` | ECK Operator |
| `otel-operator-system` | OTel Operator |
| `cert-manager` | cert-manager |
