# HIT #3 — Filtros DOM + Screenshot

Extiende el HIT #2 aplicando **tres filtros de MercadoLibre mediante clicks reales en el DOM** (sin modificar la URL a mano):

| Filtro | Valor |
|--------|-------|
| Condición | Nuevo |
| Tienda oficial | Sí |
| Ordenar por | Más relevantes |

Después de aplicar los filtros captura un screenshot guardado como `screenshots/<producto>_<browser>.png`.

---

## Requisitos previos

| Herramienta | Versión |
|-------------|---------|
| Node.js     | ≥ 18    |
| Chrome      | ≥ 112   |
| Firefox     | ≥ 115   |

---

## Instalación

```bash
cd HIT3
npm install
```

---

## Ejecución

```bash
# Chrome (ventana visible)
BROWSER=chrome node src/scrapers/mercadolibre.js
npm run scrape:chrome

# Firefox (ventana visible)
BROWSER=firefox node src/scrapers/mercadolibre.js
npm run scrape:firefox

# Headless (sin ventana, para CI)
npm run scrape:chrome:headless
npm run scrape:firefox:headless

# Ambos seguidos
npm run scrape:both:headless
```

### Salida esperada

```
============================================================
Filtros aplicados: {"condicion":true,"tiendaOficial":true,"orden":true}
Primeros 5 productos filtrados [chrome]
============================================================
  1. Bicicleta Trek Marlin 5 Rodado 29 — Tienda Oficial
  2. ...
Screenshot: /path/to/screenshots/bicicleta_rodado_29_chrome-2026-...png
============================================================
```

---

## Tests

```bash
# Unit tests (sin browser, rápidos)
npm run test:unit

# Integración + filtros — Chrome headless
npm run test:chrome

# Integración + filtros — Firefox headless
npm run test:firefox

# Todos
npm test
```

Los tests validan:
- Al menos un filtro fue aplicado vía click DOM
- `condicion:Nuevo` fue aplicado exitosamente
- ≥ 5 productos post-filtro
- Screenshot existe en disco con nombre `bicicleta_rodado_29_<browser>*.png`
- El archivo PNG tiene tamaño > 0 bytes

---

## Estructura del proyecto

```
HIT3/
├── src/
│   ├── pages/
│   │   ├── HomePage.js
│   │   ├── SearchResultsPage.js
│   │   └── FiltersPage.js          ← NUEVO: interacción con filtros sidebar
│   ├── utils/
│   │   ├── BrowserOptions.js       (de HIT2)
│   │   ├── BrowserFactory.js       (de HIT2)
│   │   ├── logger.js
│   │   └── throttle.js
│   └── scrapers/
│       └── mercadolibre.js         (flow actualizado: búsqueda → filtros → extracción)
└── tests/
    ├── browserOptions.test.js      (de HIT2)
    ├── scraper.test.js
    └── filters.test.js             ← NUEVO: tests de filtros y screenshot
```

---

## Diseño de `FiltersPage`

### Por qué clicks DOM y no URL

MercadoLibre aplica filtros navegando a una nueva URL. Modificar la URL a mano funcionaría, pero no valida que el flujo de UI sea correcto. Los clicks reales verifican que:
- Los elementos de filtro son visibles e interactuables
- Los eventos JS de MercadoLibre se disparan correctamente
- El comportamiento es idéntico al de un usuario real

### Estrategia de selectores multi-fallback

MercadoLibre tiene dos generaciones de UI activas simultáneamente (sistema clásico `ui-search-*` y sistema Polaris). Para cada filtro se define una lista de estrategias ordenadas por confiabilidad:

```
1. CSS por href fragment  → más específico, falla si cambia la URL
2. XPath desde sección    → localiza por texto del heading y baja al link
3. XPath por texto        → el más genérico, el último recurso
```

```javascript
const CONDITION_NUEVO_LOCATORS = [
  [By.css('a[href*="ITEM_CONDITION-NUEVO"]'),  'css:href'],
  [By.xpath('//li[contains(@class,"ui-search-filter-item")]' +
            '//a[starts-with(normalize-space(),"Nuevo")]'), 'xpath:text'],
];
```

### Ciclo de espera post-filtro

```
click(filtro)
  → esperar cambio de URL (10s)     ← detecta navegación a nueva página filtrada
  → esperar resultados en DOM (20s)  ← garantiza que los items están listos
```

El timeout de URL es tolerante: si MercadoLibre hace un AJAX update sin cambiar URL, el scraper continúa igual.

### Sort: `<select>` nativo + dropdown custom

El sort puede renderizarse como `<select>` nativo (Andes component) o como un dropdown custom. `FiltersPage` intenta ambos:

1. Busca `<select>` → chequea el value actual → si no es relevance, clickea la `<option>`
2. Busca trigger del dropdown → lo abre → clickea la opción de texto "Más relevantes"

Si ya está en "Más relevantes" (default) lo detecta y no genera un click innecesario.

---

## Diferencias Chrome vs Firefox

| Aspecto | Chrome | Firefox |
|---------|--------|---------|
| Filtro condición | ✓ | ✓ |
| Filtro tienda oficial | ✓ | ✓ |
| Sort | ✓ | ✓ |
| Screenshots | PNG 1920×1080 | PNG 1920×1080 |
| Tiempo total (con filtros) | ~15-20s | ~20-30s |
| Diferencias DOM | Ninguna | Ninguna |

El tiempo aumenta vs HIT1/HIT2 porque cada filtro produce una navegación completa (click → nueva URL → resultados recargados).

---

## Herramientas de IA utilizadas

- **Claude (Anthropic)**: diseño de `FiltersPage` con estrategias multi-fallback, ciclo click → espera → verificación, manejo de `<select>` nativo vs dropdown Andes, tests de validación de screenshot.
- **GitHub Copilot**: autocompletado de XPath y CSS selectors.
