# HIT #2 — Browser Factory

Refactor del HIT #1 con **Browser Factory** como pieza central: una clase que recibe la configuración del browser (nombre, headless, timeouts, dimensiones) y construye el `WebDriver` correctamente configurado.

El browser se elige por **variable de entorno** `BROWSER=firefox` o por **argumento CLI** `node scraper.js firefox`. Sin configuración explícita, usa Chrome por defecto.

Incluye un comparador cross-browser que corre ambos navegadores y genera un reporte HTML lado a lado.

---

## Requisitos previos

| Herramienta | Versión |
|-------------|---------|
| Node.js     | ≥ 18    |
| Chrome      | ≥ 112   |
| Firefox     | ≥ 115   |

> Selenium 4.x incluye **Selenium Manager** — descarga drivers automáticamente.

---

## Instalación

```bash
cd HIT2
npm install
```

---

## Ejecución

### Un browser a la vez

```bash
# Usando env var (forma principal del HIT #2)
BROWSER=chrome node src/scrapers/mercadolibre.js
BROWSER=firefox node src/scrapers/mercadolibre.js

# Usando argumento CLI
node src/scrapers/mercadolibre.js chrome
node src/scrapers/mercadolibre.js firefox

# Scripts de npm (headless para CI)
npm run scrape:chrome:headless
npm run scrape:firefox:headless
```

### Comparación cross-browser

```bash
# Corre Chrome + Firefox y genera reporte HTML
npm run compare

# Headless (para CI)
npm run compare:headless
```

---

## Tests

```bash
# Tests unitarios de BrowserOptions (sin browser real, rápidos)
npm run test:unit

# Integración — un solo browser
BROWSER=chrome npm run test:chrome
BROWSER=firefox npm run test:firefox

# Paridad cross-browser (corre ambos browsers en paralelo)
npm run test:parity

# Todos
npm test
```

---

## Estructura del proyecto

```
HIT2/
├── src/
│   ├── pages/
│   │   ├── HomePage.js
│   │   └── SearchResultsPage.js   # ahora expone selectorUsed por producto
│   ├── utils/
│   │   ├── BrowserOptions.js      ← NUEVO: value object de configuración
│   │   ├── BrowserFactory.js      ← REFACTORED: recibe BrowserOptions
│   │   ├── reporter.js            ← NUEVO: reporte de comparación HTML/JSON
│   │   ├── logger.js
│   │   └── throttle.js
│   └── scrapers/
│       ├── mercadolibre.js        ← usa BrowserOptions.fromCli()
│       └── compare.js             ← NUEVO: corre Chrome + Firefox y compara
└── tests/
    ├── browserOptions.test.js     ← NUEVO: unit tests sin browser
    ├── scraper.test.js
    └── crossBrowser.test.js       ← NUEVO: tests de paridad
```

---

## Decisiones de diseño

### `BrowserOptions` — separación configuración / construcción

En HIT #1, `BrowserFactory.create(browserName, headless)` mezclaba lectura de parámetros con construcción del driver. El problema: no se podía testear la lógica de "¿de dónde viene el browser?" sin arrancar un driver real.

En HIT #2 se separa en dos clases:

```js
// 1. Solo config — se puede instanciar en tests sin Selenium
const opts = new BrowserOptions({ browser: 'firefox', headless: true });

// 2. Factory pura — solo construye el driver
const driver = await BrowserFactory.create(opts);

// 3. Punto de entrada para scripts — lee env/args automáticamente
const driver = await BrowserFactory.fromCli();
```

### Precedencia de configuración del browser

```
BROWSER env var  >  argumento CLI  >  default ('chrome')
HEADLESS env var >  --headless CLI >  false
```

Esto permite que el mismo script funcione:
- Localmente: `node scraper.js firefox`
- En CI: `BROWSER=firefox HEADLESS=true node scraper.js`
- Con npm scripts: `npm run scrape:firefox:headless`

### `selectorUsed` en cada producto

`SearchResultsPage` ahora reporta qué selector funcionó para extraer el título de cada producto. Esto es útil para detectar si Chrome y Firefox usan rutas de render distintas (diferencias DOM).

---

## Comparación Chrome vs Firefox

| Aspecto | Chrome | Firefox | Diferencia |
|---------|--------|---------|------------|
| Headless API | `--headless=new` | `--headless` | Flag distinta; mismo comportamiento |
| Tiempo promedio | ~8s | ~11-14s | Firefox ~1.5x más lento arrancando |
| Selectores DOM | `poly-component__title` | `poly-component__title` | Sin diferencia |
| Resultados retornados | 5 | 5 | Idéntico |
| Solapamiento de títulos | — | — | ≥ 80% (mismos productos, distinto orden posible) |
| Precios | Mismo formato | Mismo formato | Sin diferencia |

### Por qué Firefox puede ser más lento

Firefox arranca `geckodriver` como proceso separado que intermedia con el navegador (arquitectura W3C WebDriver pura). Chrome usa `chromedriver` que tiene acceso más directo al motor V8/Blink. La diferencia es de arranque, no de extracción.

---

## Herramientas de IA utilizadas

- **Claude (Anthropic)**: diseño de `BrowserOptions` como value object testeable, separación de responsabilidades, reporte de comparación, suite `crossBrowser.test.js`.
- **GitHub Copilot**: autocompletado de código repetitivo y JSDoc.

---

## CI/CD

Pipeline `.github/workflows/hit2.yml`:

1. **gitleaks** — detección de secrets
2. **unit-tests** — tests de `BrowserOptions` sin browser (rápido, falla rápido)
3. **test-chrome** / **test-firefox** — en paralelo
4. **compare** — corre ambos browsers y valida paridad
5. **publish-report** — sube reporte a GitHub Pages (solo en `main`)
