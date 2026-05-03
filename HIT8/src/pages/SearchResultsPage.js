'use strict';

const { until } = require('selenium-webdriver');
const ProductParser = require('../parsers/ProductParser');
const logger = require('../utils/logger');
const MERCADOLIBRE = require('../config/selectors');

class SearchResultsPage {
  constructor(driver, explicitWait = 20000) {
    this.driver = driver;
    this.explicitWait = explicitWait;
    this.itemLocator = null;
  }

  async waitForResults() {
    const combinedSelector = MERCADOLIBRE.results.item.map(locator => locator.value).join(', ');

    try {
      const { By } = require('selenium-webdriver');
      await this.driver.wait(until.elementLocated(By.css(combinedSelector)), this.explicitWait);
      logger.info(`[SearchResultsPage] Resultados cargados correctamente en el DOM.`);
      return;
    } catch (e) {
      throw new Error(`No se encontraron resultados tras ${this.explicitWait}ms.`);
    }
  }

  async getProducts(limit = 30, productName = 'unknown', browser = 'unknown', maxPages = 3) {
    const products = [];
    let currentPage = 1;

    while (products.length < limit && currentPage <= maxPages) {
      logger.info(`[SearchResultsPage] Página ${currentPage}/${maxPages} para "${productName}"`);
      await this.waitForResults();

      const items = await this._findItems();
      logger.info(`[SearchResultsPage] ${items.length} elementos encontrados en página ${currentPage}`);

      for (let index = 0; index < items.length && products.length < limit; index++) {
        try {
          const item = items[index];
          const rawText = await item.getText();

          const title = await this._textFromSelectors(item, MERCADOLIBRE.results.title, false, productName, browser, 'title');
          const priceText = await this._textFromSelectors(item, MERCADOLIBRE.results.price, false, productName, browser, 'price');
          const link = await this._extractLink(item, productName, browser);
          const officialStoreText = await this._textFromSelectors(item, MERCADOLIBRE.results.officialStore, true, productName, browser, 'officialStore');

          const cuotasText = MERCADOLIBRE.results.installments
              ? await this._textFromSelectors(item, MERCADOLIBRE.results.installments, true, productName, browser, 'cuotas') : null;

          const freeShippingText = MERCADOLIBRE.results.freeShipping
              ? await this._textFromSelectors(item, MERCADOLIBRE.results.freeShipping, true, productName, browser, 'envio') : null;

          const product = ProductParser.toOutputProduct({
            title,
            priceText,
            link,
            rawText,
            officialStoreText,
            cuotasText,
            envioGratis: freeShippingText !== null,
          });

          products.push(product);
          logger.info(`[SearchResultsPage] ${products.length}. ${product.titulo} | ${product.precio}`);
        } catch (error) {
          logger.warn(`[SearchResultsPage] Producto omitido en "${productName}" [${browser}]: ${error.message}`);
        }
      }

      if (products.length >= limit || currentPage >= maxPages) break;

      const hasNext = await this._goToNextPage();
      if (!hasNext) {
        logger.info(`[SearchResultsPage] No hay más páginas para "${productName}"`);
        break;
      }
      currentPage++;
    }

    logger.info(`[SearchResultsPage] Total extraído: ${products.length} productos para "${productName}"`);
    return products;
  }

  async _goToNextPage() {
    try {
      const { By } = require('selenium-webdriver');
      const nextSelectors = [
        By.css('a.andes-pagination__link[rel="next"]'),
        By.css('a[rel="next"]'),
        By.css('.andes-pagination__link--next'),
        By.xpath('//a[contains(@title, "Siguiente")]'),
        By.xpath('//a[contains(text(), "Siguiente")]'),
      ];

      for (const selector of nextSelectors) {
        try {
          const nextBtn = await this.driver.findElement(selector);
          await nextBtn.click();
          await this.driver.sleep(3000);
          return true;
        } catch (e) {
          // Try next selector
        }
      }
      return false;
    } catch (error) {
      logger.warn(`[SearchResultsPage] Error navegando a siguiente página: ${error.message}`);
      return false;
    }
  }

  async waitForResults() {
    // CORRECCIÓN: Usamos la nueva ruta anidada (results.item)
    const combinedSelector = MERCADOLIBRE.results.item.map(locator => locator.value).join(', ');
    
    try {
      // Como map extrae los values (strings), acá sí le armamos el By.css global
      const { By } = require('selenium-webdriver');
      await this.driver.wait(until.elementLocated(By.css(combinedSelector)), this.explicitWait);
      logger.info(`[SearchResultsPage] Resultados cargados correctamente en el DOM.`);
      return;
    } catch (e) {
      throw new Error(`No se encontraron resultados tras ${this.explicitWait}ms.`);
    }
  }

  async getProducts(limit = 10, productName = 'unknown', browser = 'unknown') {
    const items = await this._findItems();
    const products = [];
    const max = Math.min(limit, items.length);
    logger.info(`[SearchResultsPage] Extrayendo ${max}/${items.length} resultados para "${productName}" [${browser}]`);

    for (let index = 0; index < max; index++) {
      try {
        const item = items[index];
        const rawText = await item.getText();
        
        // CORRECCIÓN: Actualizado para usar la estructura MERCADOLIBRE.results.*
        const title = await this._textFromSelectors(item, MERCADOLIBRE.results.title, false, productName, browser, 'title');
        const priceText = await this._textFromSelectors(item, MERCADOLIBRE.results.price, false, productName, browser, 'price');
        const link = await this._extractLink(item, productName, browser);
        const officialStoreText = await this._textFromSelectors(item, MERCADOLIBRE.results.officialStore, true, productName, browser, 'officialStore');

        // HIT #4: Envío Gratis y Cuotas (Agregados como opcionales)
        // Nota: Asegurate de tener installments y freeShipping en tu selectors.js
        const cuotasText = MERCADOLIBRE.results.installments 
            ? await this._textFromSelectors(item, MERCADOLIBRE.results.installments, true, productName, browser, 'cuotas') : null;
            
        const freeShippingText = MERCADOLIBRE.results.freeShipping 
            ? await this._textFromSelectors(item, MERCADOLIBRE.results.freeShipping, true, productName, browser, 'envio') : null;

        const product = ProductParser.toOutputProduct({
          title,
          priceText,
          link,
          rawText,
          officialStoreText,
          cuotasText,
          envioGratis: freeShippingText !== null,
        });

        products.push(product);
        logger.info(`[SearchResultsPage] ${index + 1}. ${product.titulo} | ${product.precio}`);
      } catch (error) {
        logger.warn(`[SearchResultsPage] Producto ${index + 1} omitido en "${productName}" [${browser}]: ${error.message}`);
      }
    }

    return products;
  }

  async _findItems() {
    const locators = this.itemLocator ? [this.itemLocator, ...MERCADOLIBRE.results.item] : MERCADOLIBRE.results.item;
    for (const locator of locators) {
      const items = await this.driver.findElements(locator);
      if (items.length > 0) {
        this.itemLocator = locator; 
        return items;
      }
    }
    return [];
  }

  async _textFromSelectors(element, selectors, optional, productName = 'unknown', browser = 'unknown', field = 'unknown') {
    for (const selector of selectors) {
      try {
        // CORRECCIÓN: Como selectors.js ya exporta By.css(), pasamos 'selector' directo
        const found = await element.findElement(selector);
        const text = ProductParser.normalizeText(await found.getText());
        if (text) return text;
        const aria = ProductParser.normalizeText(await found.getAttribute('aria-label'));
        if (aria) return aria;
      } catch (e) {
        // probar siguiente selector
      }
    }
    
    if (optional) return null; 
    
    logger.error(`[SearchResultsPage] Selector falló en "${productName}" [${browser}] - campo: ${field}`);
    throw new Error(`Texto requerido no encontrado.`);
  }

  async _extractLink(element, productName = 'unknown', browser = 'unknown') {
    const linkSelectors = MERCADOLIBRE.results.link;
    for (const selector of linkSelectors) {
      try {
        // CORRECCIÓN: Igual que arriba, se pasa el selector directo
        const href = await element.findElement(selector).getAttribute('href');
        if (href && /^https?:\/\//i.test(href)) return href;
      } catch (e) {
        // probar siguiente selector
      }
    }
    logger.error(`[SearchResultsPage] Link absoluto no encontrado en "${productName}" [${browser}]`);
    throw new Error('Link absoluto no encontrado.');
  }
}

module.exports = SearchResultsPage;