# HIT #4 — MercadoLibre Scraper Multi-Producto

Scraper académico con criterios de producción: procesa múltiples búsquedas en MercadoLibre Argentina, aplica filtros por DOM, extrae los primeros resultados y genera un JSON separado por producto.

## Estructura

```text
HIT4/
  src/
    config/          # Variables de entorno, productos y slugs de salida
    pages/           # Page Object Model: Home, filtros y resultados
    parsers/         # Parsing puro de precio, tienda, envío y cuotas
    scrapers/        # Orquestación del flujo completo
    utils/           # BrowserFactory, retry, logger y schema
    writers/         # Persistencia JSON validada
  tests/
    unit/            # Parsers, schema, writer y config
    integration/     # Flujo real con browser, activable con RUN_E2E=true
  output/            # JSON generado en runtime
  logs/              # scraper.log y error.log
```

## Instalación

```bash
cd HIT4
npm install
```

Chrome o Firefox deben estar instalados localmente. En Docker se instala Chromium y `chromium-driver`.

## Ejecución

```bash
# Chrome (ventana visible)
npm run scrape:chrome

# Firefox (ventana visible)
npm run scrape:firefox

# Chrome en modo headless (CI/CD)
npm run scrape:chrome:headless

# Firefox en modo headless
npm run scrape:firefox:headless

# Ambos navegadores seguidos
npm run scrape:both:headless
```

Archivos esperados:

```text
output/bicicleta_rodado_29.json
output/iphone_16_pro_max.json
output/geforce_5090.json
```

Ejemplo de configuración:

```bash
BROWSER=chrome \
HEADLESS=true \
RESULT_LIMIT=10 \
MAX_RETRIES=2 \
PRODUCTS="bicicleta rodado 29|iPhone 16 Pro Max|GeForce RTX 5090" \
npm run scrape
```

## Variables de entorno

| Variable | Default | Descripción |
| --- | --- | --- |
| `BROWSER` | `chrome` | `chrome` o `firefox` |
| `HEADLESS` | `false` | Ejecuta sin UI visible |
| `PRODUCTS` | productos del enunciado | Separados por `|` |
| `RESULT_LIMIT` | `10` | Cantidad por producto |
| `MAX_RETRIES` | `2` | Reintentos por producto |
| `APPLY_FILTERS` | `true` | Aplica filtros heredados del HIT3 |
| `OUTPUT_DIR` | `output` | Carpeta de JSON |
| `LOG_DIR` | `logs` | Carpeta de logs |

## Formato JSON

Cada archivo contiene un array de objetos:

```json
[
  {
    "titulo": "Bicicleta Mountain Bike Rodado 29",
    "precio": 389999,
    "link": "https://articulo.mercadolibre.com.ar/MLA-000000000",
    "tienda_oficial": null,
    "envio_gratis": true,
    "cuotas_sin_interes": "6 cuotas sin interés"
  }
]
```

## Tests

```bash
npm run test:unit
RUN_E2E=true BROWSER=chrome npm run test:integration
npm test
```

Los tests unitarios no dependen de MercadoLibre ni de un browser. El test de integración ejecuta el flujo real y valida el schema del JSON generado.

## Docker

```bash
docker build -t hit4-mercadolibre .
docker run --rm -e HEADLESS=true -v "$PWD/output:/app/output" hit4-mercadolibre
```

## CI/CD

El workflow `.github/workflows/hit4.yml`:

- Corre `gitleaks` y falla si detecta secrets.
- Instala dependencias.
- Ejecuta tests unitarios.
- Ejecuta un test de integración con browser headless.
- Ejecuta el scraper completo.
- Valida el schema JSON.
- Publica `output/*.json` y logs como artefactos.

Los secrets no se hardcodean. Si en el futuro se agregan proxies, tokens o credenciales, deben inyectarse con GitHub Secrets y variables de entorno.

## Decisiones de diseño

- Se mantiene Node.js + Selenium para ser consistente con HIT1-HIT3.
- Page Object Model separa navegación, filtros y resultados.
- El parser es puro y testeable sin DOM.
- El writer valida schema antes de persistir.
- Los selectores usan listas de fallback (`poly-*`, `ui-search-*` y alternativas genéricas) para tolerar cambios de DOM.
- El flujo por producto usa retries con backoff y logs persistidos más buffer en memoria.
