# HIT #1 — MercadoLibre Scraper

Scraper multi-browser construido con **Selenium WebDriver 4** y **Node.js**.  
Busca el producto **"bicicleta rodado 29"** en [mercadolibre.com.ar](https://www.mercadolibre.com.ar), espera a que carguen los resultados con **explicit waits**, e imprime en consola los primeros 5 productos (título y precio).

---

## Requisitos previos

| Herramienta | Versión mínima |
| ----------- | -------------- |
| Node.js     | 18.x           |
| npm         | 9.x            |
| Chrome      | 112+           |
| Firefox     | 115+           |

> **Drivers**: Selenium 4.x incluye **Selenium Manager** que descarga y gestiona `chromedriver` y `geckodriver` automáticamente. No hace falta instalarlos a mano.

---

## Instalación

```bash
cd HIT1
npm install
```

---

## Ejecución desde terminal

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

### Salida esperada

```
============================================================
Primeros 5 productos — "bicicleta rodado 29"
============================================================
  1. Bicicleta Mountain Bike Rodado 29 21 Vel Suspensión Shimano
  2. Bicicleta Rodado 29 Trek Marlin 5 Aluminio Frenos Disco
  3. Bicicleta Rodado 29 Slp Am929 21v Freno Disco Aluminio
  4. Bicicleta Montaña Venzo Mx Pro Rodado 29 Shimano 24v
  5. Bicicleta Ruta Rodado 29 Trek 1120 Adventure
============================================================
```

Además se generan:

- `results/results-<browser>-<timestamp>.json` — datos estructurados
- `results/report-<browser>-<timestamp>.html` — reporte visual
- `screenshots/<browser>-<query>-<timestamp>.png` — captura de pantalla
- `logs/scraper.log` — log completo
- `logs/error.log` — sólo errores

---

## Tests

```bash
# Todos los browsers (Chrome + Firefox headless)
npm test

# Solo Chrome
BROWSER=chrome npm test

# Solo Firefox
BROWSER=firefox npm test
```

Los tests validan:

- Se extraen al menos **5 productos**
- Cada producto cumple el **schema** `{ position, title, price, url }`
- Las posiciones son consecutivas desde 1
- No hay títulos duplicados entre los primeros 5

---

## Estructura del proyecto

```
HIT1/
├── src/
│   ├── pages/
│   │   ├── HomePage.js          # Page Object — búsqueda inicial
│   │   └── SearchResultsPage.js # Page Object — extracción de resultados
│   ├── utils/
│   │   ├── BrowserFactory.js    # Browser Factory Pattern
│   │   ├── logger.js            # Winston — logs INFO/WARN/ERROR
│   │   └── throttle.js          # Rate limiting entre requests
│   └── scrapers/
│       └── mercadolibre.js      # Entry point principal
├── tests/
│   └── scraper.test.js          # Jest — tests de schema y cantidad
├── logs/                        # Generado en runtime (gitignored)
├── results/                     # JSONs y HTML (gitignored)
├── screenshots/                 # Capturas (gitignored)
├── .env.example
├── jest.config.js
└── package.json
```

---

## Decisiones de diseño

### Selectores CSS — estrategia multi-fallback

MercadoLibre actualiza su frontend con frecuencia. En lugar de un único selector frágil, se definen **listas de selectores** en orden de preferencia:

```js
const TITLE_SELECTORS = [
  ".poly-component__title", // Polaris (versión más reciente)
  ".ui-search-item__title", // versión anterior
  "h2.poly-box", // fallback genérico
];
```

El Page Object prueba cada uno y usa el primero que retorne texto no vacío.

### Explicit Waits — sin sleep()

Toda sincronización con el DOM usa `WebDriverWait + until.*`:

```js
await driver.wait(until.elementLocated(locator), 15000);
await driver.wait(until.elementIsVisible(el), 5000);
```

El `throttle()` entre búsquedas es **rate limiting** (respeto al servidor), **no sincronización de UI**.

### Browser Factory

`BrowserFactory.create(browser, headless)` centraliza la construcción del driver. Para agregar un nuevo browser (Edge, Safari) sólo se agrega un `case` allí, sin tocar el código de los Page Objects ni el scraper.

### Page Object Model

Cada página del sitio tiene su propia clase con:

- Locators encapsulados
- Métodos de acción de alto nivel (`search()`, `getProducts()`)
- Lógica de fallback interna

Esto permite que el scraper sea legible y que los cambios de selectores se concentren en un solo lugar.

### Manejo de elementos faltantes

Si un producto no tiene precio visible (o el selector cambió), `price` se retorna como `null` con un log `WARN`. El scraping no se interrumpe.

---

## Comparación Chrome vs Firefox

| Aspecto              | Chrome                | Firefox               |
| -------------------- | --------------------- | --------------------- |
| Headless API         | `--headless=new`      | `--headless`          |
| Tiempo promedio      | ~8s                   | ~11s                  |
| Diferencias visuales | Ninguna significativa | Ninguna significativa |
| Selectores           | Idénticos             | Idénticos             |
| Screenshots          | PNG nativo            | PNG nativo            |

---

## Herramientas de IA utilizadas

- **Claude (Anthropic)**: generación del esqueleto del proyecto, estrategia de selectores multi-fallback, diseño del Page Object Model y el pipeline de CI/CD.
- **GitHub Copilot**: autocompletado de código repetitivo (selectores, tests Jest).

---

## CI/CD

El pipeline `.github/workflows/hit1.yml`:

1. **gitleaks** — falla si detecta secrets hardcodeados
2. **scrape-chrome** — corre el scraper y los tests en Chrome headless
3. **scrape-firefox** — corre el scraper y los tests en Firefox headless
4. **publish-report** — publica los resultados en GitHub Pages (solo en `main`)

Artefactos publicados por cada run: JSONs, HTML reports y screenshots.
