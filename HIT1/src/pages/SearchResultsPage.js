const { By, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const WAIT_MS = 20000;

// Selectores de contenedor de resultados — del más específico al más genérico.
// El primero que encuentre ítems con título válido gana.
const ITEM_CSS_SELECTORS = [
  'li.ui-search-layout__item',
  '.ui-search-results .ui-search-layout__item',
  '.poly-card',
  '.ui-search-result__wrapper',
];

// Selectores del input de búsqueda (para waitForResults vía URL)
const RESULTS_URL_PATTERN = /listado\.mercadolibre|search|s\?/i;

/**
 * Page Object — Página de resultados de búsqueda de MercadoLibre.
 */
class SearchResultsPage {
  constructor(driver) {
    this.driver = driver;
  }

  async waitForResults() {
    logger.info('Waiting for search results...');

    // Esperar a que la URL cambie a una página de resultados
    try {
      await this.driver.wait(async () => {
        const url = await this.driver.getCurrentUrl();
        return RESULTS_URL_PATTERN.test(url);
      }, WAIT_MS);
    } catch {
      // Continuar aunque la URL no matchee — puede ser una URL de resultado no estándar
    }

    // Esperar a que aparezcan ítems de producto vía JS (no depende de visibilidad)
    const found = await this.driver.wait(async () => {
      const count = await this.driver.executeScript(() => {
        const selectors = [
          'li.ui-search-layout__item',
          '.poly-card',
          '.ui-search-result__wrapper',
        ];
        for (const sel of selectors) {
          if (document.querySelectorAll(sel).length > 0) return true;
        }
        return false;
      });
      return count;
    }, WAIT_MS).catch(() => false);

    if (!found) {
      logger.error('Timeout esperando resultados. Tomando screenshot para debug visual...');
      try {
        const screenshot = await this.driver.takeScreenshot();
        const outputDir = path.resolve(process.cwd(), 'output');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        const filePath = path.join(outputDir, 'error-resultados-captura.png');
        fs.writeFileSync(filePath, screenshot, 'base64');
        logger.info(`Screenshot guardado en: ${filePath}`);
      } catch (err) {
        logger.error('No se pudo tomar el screenshot de debug: ' + err.message);
      }
      throw new Error('No se encontró ningún resultado en la página');
    }

    logger.info('Search results are visible');
  }

  /**
   * Extrae los primeros `limit` productos usando executeScript para máxima
   * compatibilidad en headless (getText() puede devolver vacío si el elemento
   * no está en el viewport; textContent siempre funciona).
   * @param {number} limit
   * @returns {Promise<Array<{position: number, title: string, price: string|null, url: string|null}>>}
   */
  async getProducts(limit = 5) {
    const products = await this.driver.executeScript((selectors, maxItems) => {
      let items = [];
      for (const sel of selectors) {
        items = Array.from(document.querySelectorAll(sel));
        if (items.length > 0) break;
      }

      const titleSelectors = [
        '.poly-component__title',
        '.ui-search-item__title',
        'h2',
        '[class*="title"]',
      ];
      const priceSelectors = [
        '.poly-price__current .andes-money-amount__fraction',
        '.andes-money-amount__fraction',
        '.price-tag-fraction',
        '[class*="price"] [class*="fraction"]',
      ];

      function extractText(item, sels) {
        for (const s of sels) {
          const el = item.querySelector(s);
          if (el) {
            const text = (el.textContent || '').trim();
            if (text) return text;
          }
        }
        return null;
      }

      const results = [];
      for (let i = 0; i < Math.min(maxItems, items.length); i++) {
        const item = items[i];
        const title = extractText(item, titleSelectors);
        if (!title) continue;
        const priceRaw = extractText(item, priceSelectors);
        const linkEl = item.querySelector('a[href*="mercadolibre"]') || item.querySelector('a[href]');
        results.push({
          position: results.length + 1,
          title,
          price: priceRaw ? '$' + priceRaw : null,
          url: linkEl ? linkEl.href : null,
        });
      }
      return results;
    }, ITEM_CSS_SELECTORS, limit);

    if (products.length === 0) {
      logger.warn('No product items found on page');
    } else {
      products.forEach((p) => logger.info(`[${p.position}] ${p.title} | Precio: ${p.price ?? 'N/A'}`));
    }

    return products;
  }

  /**
   * Toma un screenshot y lo guarda en /screenshots.
   * @param {string} name - nombre base del archivo
   */
  async takeScreenshot(name) {
    const screenshotsDir = path.join(__dirname, '../../screenshots');
    if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(screenshotsDir, `${name}-${timestamp}.png`);

    const data = await this.driver.takeScreenshot();
    fs.writeFileSync(filePath, data, 'base64');
    logger.info(`Screenshot saved: ${filePath}`);
    return filePath;
  }
}

module.exports = SearchResultsPage;
