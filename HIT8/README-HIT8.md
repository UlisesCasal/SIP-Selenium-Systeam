# HIT #8 — Capacidad extendida

## Funcionalidades implementadas

### 1. Paginación
- Extrae 30 resultados navegando hasta 3 páginas
- Configurable vía `RESULT_LIMIT` (default: 30) y `MAX_PAGES` (default: 3)

### 2. Comparación de precios
- Calcula y muestra: precio mínimo, máximo, mediana y desvío estándar
- Implementado en `src/utils/stats.js`
- Testeado en `tests/unit/stats.test.js`

### 3. Histórico con PostgreSQL
- **Schema versionado** en `migrations/001_create_scrape_results.sql`
- **StatefulSet** + PVC + Service en `k8s/`
- **Credenciales** via Secret (`k8s/postgres-secret.yaml`)
- **Migraciones automáticas** al conectar (`PostgresWriter._runMigrations()`)
- Tabla mínima: `scrape_results` con índice por producto y fecha

## Despliegue en k3s/k3d

### Pre-requisitos
- k3s o k3d cluster corriendo
- kubectl configurado
- Docker (para build de imagen)

### Pasos

1. **Crear namespace:**
   ```bash
   kubectl create namespace sip-selenium
   ```

2. **Build de la imagen:**
   ```bash
   docker build -t ml-scraper:latest .
   ```

3. **Importar imagen al cluster (k3d):**
   ```bash
   k3d image import ml-scraper:latest -c <cluster-name>
   ```
   O configurar un registry local y actualizar `k8s/cronjob.yaml`.

4. **Aplicar manifiestos:**
   ```bash
   kubectl apply -f k8s/postgres-secret.yaml -n sip-selenium
   kubectl apply -f k8s/postgres-pvc.yaml -n sip-selenium
   kubectl apply -f k8s/postgres-service.yaml -n sip-selenium
   kubectl apply -f k8s/postgres-statefulset.yaml -n sip-selenium
   kubectl apply -f k8s/configmap.yaml -n sip-selenium
   kubectl apply -f k8s/migrations-configmap.yaml -n sip-selenium
   kubectl apply -f k8s/pvc-scraper-output.yaml -n sip-selenium
   kubectl apply -f k8s/cronjob.yaml -n sip-selenium
   ```

5. **Probar manualmente:**
   ```bash
   kubectl create job --from=cronjob/scraper-hourly manual-test -n sip-selenium
   kubectl logs -l job-name=manual-test -n sip-selenium -c scraper --tail=50
   ```

6. **Ver datos en PostgreSQL:**
   ```bash
   kubectl exec -it postgres-0 -n sip-selenium -- psql -U scraper -d scraperdb -c "SELECT producto, COUNT(*), MIN(precio), MAX(precio), AVG(precio) FROM scrape_results GROUP BY producto;"
   ```

## Ejecución local (sin k3s)

```bash
POSTGRES_ENABLED=false npm run scrape
```

Esto generará archivos JSON en `output/` con 30 resultados y estadísticas de precio.

## Tests

```bash
npm test
```

Todos los tests pasan (23/23) incluyendo:
- `stats.test.js`: Cálculo de estadísticas
- `postgresWriter.test.js`: Escritura a PostgreSQL
- `config.test.js`, `productParser.test.js`, `jsonWriter.test.js`, `retry.test.js`, `schema.test.js`
