# EFK Stack para Scraper Logs

Stack completo de observabilidad para los logs del scraper de MercadoLibre: Elasticsearch, Fluent Bit y Kibana (EFK).

## Arquitectura

- **Elasticsearch**: Almacenamiento y búsqueda de logs
- **Fluent Bit**: Recolección de logs desde archivos `/var/log/scraper/*.log`
- **Kibana**: Visualización y dashboards

## Requisitos previos

- Kubernetes cluster (local con k3s/minikube o cloud)
- Helm 3.x
- kubectl configurado

## Instalación rápida

```bash
cd efk
./install.sh
```

El script es **idempotente**: puede ejecutarse múltiples veces sin problemas.

## Output esperado al final:

# ✓ ECK Operator running (kubectl get pod -n elastic-system)

# ✓ Elasticsearch green (kubectl get elasticsearch -n elastic)

# ✓ Kibana available (NodePort 30001 abierto)

# ✓ Fluent Bit DaemonSet ready (1 pod por nodo, status Running)

# ✓ ILM policy 'scraper-logs' aplicada

# ✓ Index pattern 'scraper-\*' creado

# ✓ Dashboard 'Scraper Overview' importado

→ Abrir https://<node-ip>:30001 (elastic / <ver secret>)

## Acceso a Kibana

Una vez instalado, acceder a Kibana en `https://<node-ip>:30001`

Credenciales:

- Usuario: `elastic`
- Password: `kubectl get secret quickstart-es-elastic-user -n elastic -o jsonpath='{.data.elastic}' | base64 -d`

## Logs del scraper

Los scrapers deben escribir logs a `/var/log/scraper/` para que Fluent Bit los recolecte.

Ejemplo de estructura de log esperada:

```json
{
  "@timestamp": "2023-05-01T12:00:00.000Z",
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

Importar desde `dashboards/scraper-overview.ndjson`.

## Limpieza

```bash
helm uninstall eck-operator -n elastic-system
helm uninstall fluent-bit -n elastic
kubectl delete namespace elastic
```
