# HIT #5 — Robustez: Selectores Centralizados, Retries y Logging Estructurado

Extiende el HIT #4 con mecanismos de robustez para entornos de producción: selectores en módulo aparte, manejo de campos opcionales, reintentos con backoff exponencial y logging estructurado con rotación de archivos.

---

## Requisitos previos

| Herramienta | Versión |
| ----------- | ------- |
| Node.js     | ≥ 18    |
| Chrome      | ≥ 112   |
| Firefox     | ≥ 115   |

---

## Instalación

```bash
cd HIT5
npm install
```

---

## Ejecución

```bash
# Headless (modo producción, sin ventana)
npm run scrape:headless

# Chrome visible
npm run scrape:chrome

# Firefox visible
npm run scrape:firefox

# Ambos seguidos (headless)
npm run scrape:both:headless
```

### Variables de entorno

```bash
BROWSER=chrome \
HEADLESS=true \
RESULT_LIMIT=10 \
MAX_RETRIES=3 \
PRODUCTS="bicicleta rodado 29|iPhone 16 Pro Max|GeForce RTX 5090" \
npm run scrape
```

### Salida esperada

```text
output/bicicleta_rodado_29.json
output/iphone_16_pro_max.json
output/geforce_5090.json
logs/scraper-YYYY-MM-DD.log
logs/error-YYYY-MM-DD.log
```

---

## Cambios respecto al HIT #4

### 1. Selectores centralizados (`src/config/selectors.js`)

Todos los selectores CSS/XPath se movieron a un único módulo. Un cambio de DOM en MercadoLibre se arregla en un solo lugar.

```javascript
module.exports = {
  home: { searchInput: [...] },
  results: { item: [...], title: [...], price: [...], officialStore: [...], link: [...] },
  filters: { conditionNew: '//xpath...', officialStores: '//xpath...' }
};
```

Los Page Objects (`HomePage`, `SearchResultsPage`, `FiltersPage`) importan desde este módulo.

### 2. Retries con backoff exponencial (`src/utils/retry.js`)

Configuración: **3 intentos**, demoras de **2s, 4s, 8s** (base 2000ms, factor 2).

```javascript
retry(fn, {
  retries: 3,
  delayMs: 2000,
  factor: 2,
  label: "scrape:producto",
  logger,
});
```

Si un selector falla por timeout, el log registra:

```
[retry] scrape:bicicleta rodado 29 falló intento 1/4 (TimeoutError). Reintentando en 2000ms
```

### 3. Logging estructurado con rotación (`src/utils/logger.js`)

Reemplaza `console.log` por **winston + winston-daily-rotate-file**:

- Formato: `YYYY-MM-DDTHH:mm:ssZ | LEVEL   | mensaje {"meta":"datos"}`
- Rotación: archivos de máximo **2 MB**, se conservan **3 archivos** por tipo.
- Transportes:
  - `Console` (visible en `kubectl logs` y GitHub Actions)
  - `scraper-YYYY-MM-DD.log` (info y superior)
  - `error-YYYY-MM-DD.log` (solo errores)

Evita que el PVC en Kubernetes se llene por logs infinitos.

### 4. Manejo de campos opcionales

Los campos `tienda_oficial`, `cuotas_sin_interes` devuelven `null` si no existen. El scraper **no rompe** la ejecución.

```javascript
// SearchResultsPage.js
async _textFromSelectors(element, selectorList, optional) {
  ...
  if (optional) return null;          // ← campos opcionales
  throw new Error('Texto requerido no encontrado');
}
```

---

## Tests

```bash
# Unit tests (sin browser, rápidos)
npm run test:unit

# Integración — Chrome headless
npm run test:chrome

# Integración — Firefox headless
npm run test:firefox

# Todos
npm test
```

Los tests validan:

- La función `retry` reintenta 3 veces ante `TimeoutException`
- El parser devuelve `null` para campos opcionales ausentes
- El logging estructurado emite timestamp y nivel correctos
- Selectores centralizados cargan correctamente

---

## Estructura del proyecto

```
HIT5/
├── src/
│   ├── config/
│   │   ├── selectors.js          ← NUEVO: selectores centralizados
│   │   ├── ScraperConfig.js
│   │   └── products.js
│   ├── pages/
│   │   ├── HomePage.js           (usa selectores centralizados)
│   │   ├── SearchResultsPage.js  (usa selectores centralizados)
│   │   └── FiltersPage.js        (usa selectores centralizados)
│   ├── parsers/
│   │   └── ProductParser.js
│   ├── scrapers/
│   │   └── MercadoLibreScraper.js
│   ├── utils/
│   │   ├── retry.js              ← ACTUALIZADO: 3 intentos, backoff 2s/4s/8s
│   │   ├── logger.js             ← ACTUALIZADO: winston + rotación diaria
│   │   ├── BrowserFactory.js
│   │   └── schema.js
│   └── writers/
│       └── JsonWriter.js
├── tests/
│   ├── unit/                     (tests de retry, logger, parsers)
│   └── integration/
├── output/                        (JSON generados)
└── logs/                          (logs rotativos)
```

---

## Ejemplo de log estructurado

```
2026-05-01T18:36:00-03:00 | INFO    | [SearchResultsPage] Resultados con li.ui-search-layout__item
2026-05-01T18:36:01-03:00 | WARN    | [retry] scrape:bicicleta rodado 29 falló intento 1/4 (TimeoutError). Reintentando en 2000ms
2026-05-01T18:36:03-03:00 | INFO    | [SearchResultsPage] 1. Bicicleta ... | 389999
2026-05-01T18:36:04-03:00 | WARN    | [SearchResultsPage] Producto 3 omitido: Texto requerido no encontrado con selectores: a.poly-component__title, ...
```

---

## Diferencias Chrome vs Firefox

| Aspecto      | Chrome         | Firefox        |
| ------------ | -------------- | -------------- |
| Selectores   | ✓              | ✓              |
| Retries      | 3 intentos     | 3 intentos     |
| Logging      | Console + File | Console + File |
| Tiempo total | ~20-30s        | ~30-40s        |

---

## Herramientas de IA utilizadas

- **Claude (Anthropic)**: diseño de módulo de selectores centralizados, configuración de backoff exponencial con contexto de log, implementación de winston-daily-rotate-file para entornos Kubernetes.
- **GitHub Copilot**: autocompletado de imports y refactor de Page Objects hacia selectores centralizados.
