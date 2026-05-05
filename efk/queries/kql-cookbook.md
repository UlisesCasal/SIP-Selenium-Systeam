# KQL Cookbook - Scraper Logs Queries

Este documento contiene queries KQL (Kibana Query Language) útiles para analizar los logs del scraper de MercadoLibre.

## 1. Logs de errores generales

```
level: "error"
```

Muestra todos los logs con nivel error.

## 2. Búsquedas exitosas por producto

```
message: "Scraping completed" AND product: "bicicleta rodado 29"
```

Logs de finalización exitosa para un producto específico.

## 3. Fallos de scraping por timeout

```
message: *timeout* OR message: *retry*
```

Identifica problemas de timeout y reintentos.

## 4. Rendimiento: duración de scraping

```
message: "Scraping took*" AND duration > 30
```

Scrapings que tomaron más de 30 segundos.

## 5. Errores por navegador

```
browser: "chrome" AND level: "error"
```

Errores específicos de Chrome.

## 6. Logs de un día específico

```
@timestamp: [2023-05-01 TO 2023-05-02]
```

Logs de un rango de fechas.

## 7. Productos con más resultados

```
message: "Found * results" AND results > 50
```

Productos con muchos resultados encontrados.

## 8. Warnings de filtros

```
level: "warn" AND message: *filter*
```

Advertencias relacionadas con filtros aplicados.
