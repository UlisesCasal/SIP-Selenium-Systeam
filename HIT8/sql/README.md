# SQL Migrations

Migraciones versionadas para el esquema de base de datos del scraper.

## Ejecución manual

```bash
# Aplicar todas las migraciones
psql -h postgres -U scraper -d scraperdb -f sql/migrations/001_create_scrape_results.sql
psql -h postgres -U scraper -d scraperdb -f sql/migrations/002_add_cuotas_column.sql
```

## Query de ejemplo para evolución de precios

```sql
SELECT producto, MIN(precio) as min, MAX(precio) as max,
       AVG(precio) as avg, COUNT(DISTINCT scraped_at) AS n_runs
FROM scrape_results
WHERE scraped_at > NOW() - INTERVAL '7 days'
GROUP BY producto;
```
