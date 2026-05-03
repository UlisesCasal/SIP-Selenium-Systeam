# HIT #8 — Capacidad extendida

Extiende el scraper con tres nuevas capacidades: **paginación**, **comparación de precios** e **histórico con PostgreSQL**.

---

## Características implementadas

### 1. Paginación (hasta 3 páginas, 30 resultados)

El scraper ahora navega automáticamente por hasta **3 páginas** de resultados, extrayendo hasta **30 productos** por búsqueda.

- Busca el botón "Siguiente" (`rel="next"`) al final de cada página
- Se detiene si no hay más páginas o se alcanzó el límite
- Configurable vía `RESULT_LIMIT` (default: 30) y `MAX_PAGES` (default: 3)

**Archivo:** `src/pages/SearchResultsPage.js` — método `getProducts()` y `_goToNextPage()`

---

### 2. Comparación de precios (estadísticas)

Por cada producto buscado, el scraper calcula y muestra en consola:

| Métrica | Descripción |
|---------|-------------|
| **Mínimo** | Precio más bajo encontrado |
| **Máximo** | Precio más alto encontrado |
| **Mediana** | Valor central de los precios ordenados |
| **Desvío estándar** | Dispersión de precios respecto al promedio |

**Ejemplo de salida:**
```
======================================================================
Estadísticas de precio para "iPhone 16 Pro Max" (30 resultados)
======================================================================
  Mínimo     : $1500000
  Máximo     : $2500000
  Mediana    : $1850000
  Desvío Std : $280000.50
======================================================================
```

**Archivo:** `src/scrapers/MercadoLibreScraper.js` — método `_printPriceStats()`

---

### 3. Histórico con PostgreSQL

Guarda todos los resultados en una base PostgreSQL dentro del cluster k3s para detectar cambios de precio entre corridas del CronJob.

#### 3.1 Schema (versionado con migraciones SQL)

```sql
CREATE TABLE IF NOT EXISTS scrape_results (
    id               BIGSERIAL PRIMARY KEY,
    producto         TEXT      NOT NULL,
    titulo           TEXT      NOT NULL,
    precio           NUMERIC(12,2),
    link             TEXT,
    tienda_oficial   TEXT,
    envio_gratis     BOOLEAN,
    cuotas_sin_interes TEXT,
    scraped_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_results_producto_fecha
    ON scrape_results (producto, scraped_at DESC);
```

#### 3.2 Despliegue en k3s

Se crearon los siguientes manifiestos en `k8s/postgres/`:

| Archivo | Descripción |
|---------|-------------|
| `secret.yaml` | Credenciales (user: `scraper`, pass: `scraper123`, db: `scraperdb`) |
| `pvc.yaml` | PersistentVolumeClaim de 2Gi |
| `service.yaml` | Servicio headless para el StatefulSet |
| `statefulset.yaml` | Postgres 16 Alpine con init container para migraciones |

#### 3.3 Writer de PostgreSQL

**Archivo:** `src/writers/PostgresWriter.js`

- Usa el paquete `pg` (Pool de conexiones)
- Inserta cada producto en `scrape_results` con timestamp
- Se activa con `POSTGRES_ENABLED=true`


---

## Configuración (variables de entorno)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `RESULT_LIMIT` | `30` | Cantidad de resultados a extraer |
| `MAX_PAGES` | `3` | Máximo de páginas a navegar |
| `POSTGRES_ENABLED` | `false` | Activar guardado en PostgreSQL |
| `POSTGRES_HOST` | `postgres` | Host de PostgreSQL |
| `POSTGRES_PORT` | `5432` | Puerto de PostgreSQL |
| `POSTGRES_USER` | `scraper` | Usuario de la DB |
| `POSTGRES_PASSWORD` | `scraper123` | Contraseña de la DB |
| `POSTGRES_DB` | `scraperdb` | Nombre de la base de datos |

---

## Cómo ejecutar

### Localmente (con PostgreSQL local)

```bash
# Instalar dependencias
npm install

# Ejecutar con Postgres deshabilitado (solo JSON)
node src/scrapers/mercadolibre.js

# Ejecutar con Postgres habilitado
POSTGRES_ENABLED=true POSTGRES_HOST=localhost npm run scrape
```

### En k3s

```bash
# 1. Aplicar Postgres
kubectl apply -f k8s/postgres/secret.yaml
kubectl apply -f k8s/postgres/pvc.yaml
kubectl apply -f k8s/postgres/service.yaml
kubectl apply -f k8s/postgres/statefulset.yaml

# Esperar a que Postgres esté listo
kubectl wait --for=condition=ready pod -l app=postgres --timeout=60s

# 2. Aplicar scraper (ConfigMap + CronJob)
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/cronjob.yaml

# 3. Ver logs del scraper
kubectl logs -l job-name=scraper-once --tail=100
```

---

## Query para evolución de precios

Con el histórico en PostgreSQL, podés consultar la evolución de precios sin código adicional:

```sql
-- Evolución de precios en los últimos 7 días
SELECT producto,
       MIN(precio) as precio_min,
       MAX(precio) as precio_max,
       AVG(precio) as precio_promedio,
       COUNT(DISTINCT scraped_at) AS cantidad_corridas
FROM scrape_results
WHERE scraped_at > NOW() - INTERVAL '7 days'
GROUP BY producto;
```

```sql
-- Ver todos los precios de un producto específico
SELECT titulo, precio, tienda_oficial, scraped_at
FROM scrape_results
WHERE producto ILIKE '%iphone 16%'
ORDER BY scraped_at DESC, precio ASC;
```

---

## Dependencias agregadas

```json
{
  "dependencies": {
    "pg": "^8.13.0"
  }
}
```

---

## Notas para el equipo

1. **Paginación:** El scraper intenta navegar hasta 3 páginas automáticamente. Si no encuentra el botón "Siguiente", se detiene.

2. **PostgreSQL en k3s:** El StatefulSet usa un `initContainer` que aplica las migraciones automáticamente al iniciar.

3. **Credenciales:** Están en `k8s/postgres/secret.yaml` como `stringData`. Para producción, usar `data` con base64.

4. **CronJob:** Está configurado para correr cada hora (`0 * * * *`). Se puede cambiar en `k8s/cronjob.yaml`.
