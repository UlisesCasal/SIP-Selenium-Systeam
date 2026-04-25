const { By, until } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

const WAIT_MS = 20000;

// Selectores de MercadoLibre — en orden de preferencia según versión del sitio.
// "poly-*" corresponde al sistema Polaris (versión más reciente).
// "ui-search-*" corresponde a la versión anterior todavía presente en algunos casos.
const ITEM_LOCATORS = [
  By.css('li.ui-search-layout__item'),
  By.css('.ui-search-results .ui-search-layout__item'),
  By.css('.poly-card'),
];

const TITLE_SELECTORS = [
  '.poly-component__title',
  '.ui-search-item__title',
  'h2.poly-box',
  '.ui-search-item__group__element h2',
];

const PRICE_SELECTORS = [
  '.poly-price__current .andes-money-amount__fraction',
  '.andes-money-amount__fraction',
  '.price-tag-fraction',
];

/**
 * Page Object — Página de resultados de búsqueda de MercadoLibre.
 */
class SearchResultsPage {
  constructor(driver) {
    this.driver = driver;
  }

  async waitForResults() {
    logger.info('Waiting for search results...');

    // Explicit wait: espera a que aparezca al menos un item de resultado
    let found = false;
    for (const locator of ITEM_LOCATORS) {
      try {
        await this.driver.wait(until.elementLocated(locator), WAIT_MS);
        found = true;
        logger.info(`Results container found with: ${locator.toString()}`);
        break;
      } catch {
        // probar siguiente
      }
    }

    if (!found) {
      throw new Error('No se encontró ningún resultado en la página');
    }

    // Explicit wait adicional: espera a que los items sean visibles
    for (const locator of ITEM_LOCATORS) {
      try {
        const el = await this.driver.findElement(locator);
        await this.driver.wait(until.elementIsVisible(el), 5000);
        break;
      } catch {
        // continuar
      }
    }

    logger.info('Search results are visible');
  }

  /**
   * Extrae los primeros `limit` productos de la página de resultados.
   * @param {number} limit
   * @returns {Promise<Array<{position: number, title: string, price: string|null, url: string|null}>>}
   */
  async getProducts(limit = 5) {
    let items = [];

    for (const locator of ITEM_LOCATORS) {
      items = await this.driver.findElements(locator);
      if (items.length > 0) {
        logger.info(`Found ${items.length} items with: ${locator.toString()}`);
        break;
      }
    }

    if (items.length === 0) {
      logger.warn('No product items found on page');
      return [];
    }

    const products = [];
    const count = Math.min(limit, items.length);

    for (let i = 0; i < count; i++) {
      const item = items[i];
      try {
        const title = await this._extractText(item, TITLE_SELECTORS);
        const price = await this._extractText(item, PRICE_SELECTORS, true);
        const url = await this._extractLink(item);

        const product = {
          position: i + 1,
          title,
          price: price ? `$${price}` : null,
          url,
        };

        products.push(product);
        logger.info(`[${i + 1}] ${title} | Precio: ${product.price ?? 'N/A'}`);
      } catch (err) {
        logger.error(`Error extrayendo producto ${i + 1}: ${err.message}`);
      }
    }

    return products;
  }

  /**
   * Toma un screenshot y lo guarda en /screenshots.
   * @param {string} name - nombre base del archivo
   */
  async takeScreenshot(name) {
    const screenshotsDir = path.join(__dirname, '../../screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(screenshotsDir, `${name}-${timestamp}.png`);

    const data = await this.driver.takeScreenshot();
    fs.writeFileSync(filePath, data, 'base64');

    logger.info(`Screenshot saved: ${filePath}`);
    return filePath;
  }

  async _extractText(element, selectors, optional = false) {
    for (const selector of selectors) {
      try {
        const el = await element.findElement(By.css(selector));
        const text = await el.getText();
        if (text.trim()) return text.trim();
      } catch {
        // probar siguiente selector
      }
    }
    if (!optional) throw new Error(`No se encontró texto con selectores: ${selectors.join(', ')}`);
    return null;
  }

  async _extractLink(element) {
    const linkSelectors = ['a.poly-component__title', 'a.ui-search-item__group__element', 'a'];
    for (const selector of linkSelectors) {
      try {
        const el = await element.findElement(By.css(selector));
        const href = await el.getAttribute('href');
        if (href) return href;
      } catch {
        // continuar
      }
    }
    return null;
  }
}

module.exports = SearchResultsPage;
