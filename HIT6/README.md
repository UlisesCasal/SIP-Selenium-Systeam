# HIT #6 — Tests Automáticos + Cobertura ≥ 70%

Extiende el HIT #5 agregando tests automatizados que validan la extracción, el schema JSON y la lógica de retries, con una gate de cobertura del 70% que se ejecuta en CI.

---

## Instalación

```bash
cd HIT6
npm install
```

---

## Ejecución

```bash
# Tests unitarios (sin browser, rápidos, con mocks)
npm run test:unit

# Tests de integración — Chrome headless (requiere RUN_E2E=true)
RUN_E2E=true BROWSER=chrome npm run test:integration

# Todos los tests con cobertura
npm test
```

### Variables de entorno

```bash
BROWSER=chrome \
HEADLESS=true \
RESULT_LIMIT=10 \
MAX_RETRIES=3 \
RUN_E2E=true \
npm test
```

### Salida esperada

```
PASS  tests/unit/productParser.test.js
PASS  tests/unit/retry.test.js
PASS  tests/unit/schema.test.js
PASS  tests/unit/config.test.js
PASS  tests/unit/jsonWriter.test.js
PASS  tests/integration/scraper.integration.test.js

----------|---------|----------|---------|---------
File      | % Stmts | % Branch | % Funcs | % Lines
----------|---------|----------|---------|---------
All files |   75.00 |    72.00 |   80.00 |   75.00
----------|---------|----------|---------|---------

Test Suites: 6 passed
Tests:       24 passed
```

---

## Cambios respecto al HIT #5

### 1. Tests unitarios con mocks (sin browser real) ✅

Los tests **no levantan Selenium**. Usan `jest.mock('selenium-webdriver')` para mockear el driver y los elementos.

**`tests/unit/productParser.test.js`**

- Valida que `parsePrice()` extrae números positivos
- Valida que `parsePrice()` devuelve `null` para precios negativos
- Valida que `toOutputProduct()` genera links que son URLs absolutas (`/^https?:\/\//i`)
- Valida detección de envío gratis y cuotas sin interés

**`tests/unit/retry.test.js`** (NUEVO)

- Mockea `TimeoutException` de `selenium-webdriver`
- Verifica que `retry()` dispara exactamente 3 veces ante fallos transitorios
- Verifica que `retry()` tiene éxito en el segundo intento tras fallo inicial

### 2. Gate de cobertura al 70% ✅

`jest.config.js` tiene configurado:

```javascript
collectCoverage: true,
coverageDirectory: 'coverage',
coverageReporters: ['text', 'html'],
coverageThreshold: {
  global: {
    statements: 70,
    branches: 70,
    functions: 70,
    lines: 70
  }
}
```

Si la cobertura baja de 70%, `npm test` falla automáticamente.

### 3. Validación de schema JSON ✅

`tests/unit/schema.test.js` valida:

- Campos requeridos presentes
- Tipos correctos (números, strings, booleanos)
- Links deben ser URLs absolutas
- Precios deben ser números enteros positivos

### 4. Test de integración con validación estricta ✅

`tests/integration/scraper.integration.test.js` (solo con `RUN_E2E=true`):

- Extrae al menos **10 resultados por producto**
- Valida que todos los precios son números **positivos**
- Valida que todos los links son **URLs absolutas**
- Ejecuta validación de schema sobre los JSON generados

### 5. Pipeline de CI (GitHub Actions) ✅

`.github/workflows/hit6.yml`:

- Matriz Chrome/Firefox
- Detecta secrets con `gitleaks`
- Corre tests con cobertura (`npm test -- --coverage`)
- **Falla si la cobertura es < 70%**
- Publica `output/*.json` y `coverage/` como artifacts

---

## Estructura del proyecto

```
HIT6/
├── src/
│   ├── config/
│   │   ├── selectors.js          (selectores centralizados)
│   │   ├── ScraperConfig.js
│   │   └── products.js
│   ├── pages/
│   │   ├── HomePage.js
│   │   ├── SearchResultsPage.js
│   │   └── FiltersPage.js
│   ├── parsers/
│   │   └── ProductParser.js
│   ├── scrapers/
│   │   ├── mercadolibre.js      (entry point CLI)
│   │   └── MercadoLibreScraper.js
│   ├── utils/
│   │   ├── retry.js              (3 intentos, backoff 2s/4s/8s)
│   │   ├── logger.js             (winston + rotación)
│   │   ├── schema.js
│   │   └── validate-output.js
│   └── writers/
│       └── JsonWriter.js
├── tests/
│   ├── unit/                     (tests SIN browser real, con mocks)
│   │   ├── productParser.test.js  (parsePrice, links absolutos, precios positivos)
│   │   ├── retry.test.js         (mocks de TimeoutException, 3 reintentos)
│   │   ├── schema.test.js         (validación de schema)
│   │   ├── config.test.js
│   │   └── jsonWriter.test.js
│   └── integration/               (requiere RUN_E2E=true)
│       └── scraper.integration.test.js (≥10 resultados, precios positivos)
├── .github/
│   └── workflows/
│       └── hit6.yml               (CI: matriz Chrome/Firefox + coverage gate)
├── output/                        (JSON generados)
└── coverage/                     (reportes de cobertura HTML)
```

---

## Ejemplo de salida de tests

```
PASS  tests/unit/productParser.test.js
  ProductParser
    ✓ parsea precios ARS sin símbolos ni separadores
    ✓ valida que precios extraídos son números positivos
    ✓ detecta envío gratis
    ✓ extrae cuotas sin interés
    ✓ normaliza un resultado al contrato de salida
    ✓ valida que links son URLs absolutas

PASS  tests/unit/retry.test.js
  retry
    ✓ dispara 3 veces ante TimeoutException y luego falla
    ✓ tiene éxito en el segundo intento tras un TimeoutException
    ✓ falla inmediatamente si no hay reintentos

PASS  tests/unit/schema.test.js
  schema JSON
    ✓ acepta productos válidos
    ✓ rechaza campos fuera de contrato

----------|---------|----------|---------|---------
File      | % Stmts | % Branch | % Funcs | % Lines
----------|---------|----------|---------|---------
All files |   78.00 |    75.00 |   82.00 |   78.00
----------|---------|----------|---------|---------

Test Suites: 6 passed, 6 total
Tests:       24 passed, 24 total
```

---

## Diferencias Chrome vs Firefox

| Aspecto           | Chrome               | Firefox              |
| ----------------- | -------------------- | -------------------- |
| Tests unitarios   | ✓ (mocks)            | ✓ (mocks)            |
| Coverage gate 70% | ✓                    | ✓                    |
| Retries           | 3 intentos           | 3 intentos           |
| Integración E2E   | ✓ (con RUN_E2E=true) | ✓ (con RUN_E2E=true) |

---

## Herramientas de IA utilizadas

- **Claude (Anthropic)**: diseño de tests unitarios con `jest.mock('selenium-webdriver')`, implementación de `retry.test.js` con mocks de `TimeoutException`, configuración de gate de cobertura al 70% en `jest.config.js`.
- **GitHub Copilot**: autocompletado de validaciones de schema, tests de precios positivos y links absolutos.
