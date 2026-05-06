"use strict";

const { until } = require("selenium-webdriver");
const ProductParser = require("../parsers/ProductParser");
const logger = require("../utils/logger");
const MERCADOLIBRE = require("../config/selectors");

class SearchResultsPage {
  constructor(driver, explicitWait = 20000) {
    this.driver = driver;
    this.explicitWait = explicitWait;
    this.itemLocator = null;
  }

  async waitForResults() {
    // CORRECCIÓN: Usamos la nueva ruta anidada (results.item)
    const combinedSelector = MERCADOLIBRE.results.item
      .map((locator) => locator.value)
      .join(", ");

    try {
      // Como map extrae los values (strings), acá sí le armamos el By.css global
      const { By } = require("selenium-webdriver");
      await this.driver.wait(
        until.elementLocated(By.css(combinedSelector)),
        this.explicitWait,
      );
      logger.info(
        "[SearchResultsPage] Resultados cargados",
        { event: "results_loaded", selector: combinedSelector }
      );
      return;
    } catch (e) {
      throw new Error(
        `No se encontraron resultados tras ${this.explicitWait}ms.`,
      );
    }
  }

  async getProducts(limit = 10, productName = "unknown", browser = "unknown") {
    const items = await this._findItems();
    const products = [];
    const max = Math.min(limit, items.length);
      logger.info(
        "[SearchResultsPage] Extrayendo resultados",
        {
          event: "extract_start",
          productName: productName,
          browser: browser,
          max: max,
          total_items: items.length,
        }
      );

    for (let index = 0; index < max; index++) {
      try {
        const item = items[index];
        const rawText = await item.getText();

        // CORRECCIÓN: Actualizado para usar la estructura MERCADOLIBRE.results.*
        const title = await this._textFromSelectors(
          item,
          MERCADOLIBRE.results.title,
          false,
          productName,
          browser,
          "title",
        );
        const priceText = await this._textFromSelectors(
          item,
          MERCADOLIBRE.results.price,
          false,
          productName,
          browser,
          "price",
        );
        const link = await this._extractLink(item, productName, browser);
        const officialStoreText = await this._textFromSelectors(
          item,
          MERCADOLIBRE.results.officialStore,
          true,
          productName,
          browser,
          "officialStore",
        );

        // HIT #4: Envío Gratis y Cuotas (Agregados como opcionales)
        // Nota: Asegurate de tener installments y freeShipping en tu selectors.js
        const cuotasText = MERCADOLIBRE.results.installments
          ? await this._textFromSelectors(
              item,
              MERCADOLIBRE.results.installments,
              true,
              productName,
              browser,
              "cuotas",
            )
          : null;

        const freeShippingText = MERCADOLIBRE.results.freeShipping
          ? await this._textFromSelectors(
              item,
              MERCADOLIBRE.results.freeShipping,
              true,
              productName,
              browser,
              "envio",
            )
          : null;

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
        logger.info(
          "[SearchResultsPage] Producto extraído",
          {
            event: "product_extracted",
            index: index + 1,
            title: product.titulo,
            price: product.precio,
            productName: productName,
            browser: browser,
          }
        );
      } catch (error) {
        logger.warn(
          "[SearchResultsPage] Error extrayendo producto",
          {
            event: "extract_error",
            index: index + 1,
            productName: productName,
            browser: browser,
            error: error.message,
          }
        );
      }
    }

    return products;
  }

  async _findItems() {
    const locators = this.itemLocator
      ? [this.itemLocator, ...MERCADOLIBRE.results.item]
      : MERCADOLIBRE.results.item;
    for (const locator of locators) {
      const items = await this.driver.findElements(locator);
      if (items.length > 0) {
        this.itemLocator = locator;
        return items;
      }
    }
    return [];
  }

  async _textFromSelectors(
    element,
    selectors,
    optional,
    productName = "unknown",
    browser = "unknown",
    field = "unknown",
  ) {
    for (const selector of selectors) {
      try {
        // CORRECCIÓN: Como selectors.js ya exporta By.css(), pasamos 'selector' directo
        const found = await element.findElement(selector);
        const text = ProductParser.normalizeText(await found.getText());
        if (text) return text;
        const aria = ProductParser.normalizeText(
          await found.getAttribute("aria-label"),
        );
        if (aria) return aria;
      } catch (e) {
        // probar siguiente selector
      }
    }

    if (optional) return null;

    logger.error(
      "[SearchResultsPage] Selector falló",
      {
        event: "selector_failed",
        productName: productName,
        browser: browser,
        field: field,
      }
    );
    throw new Error(`Texto requerido no encontrado.`);
  }

  async _extractLink(element, productName = "unknown", browser = "unknown") {
    const linkSelectors = MERCADOLIBRE.results.link;
    for (const selector of linkSelectors) {
      try {
        // CORRECCIÓN: Igual que arriba, se pasa el selector directo
        const href = await element.findElement(selector).getAttribute("href");
        if (href && /^https?:\/\//i.test(href)) return href;
      } catch (e) {
        // probar siguiente selector
      }
    }
    logger.error(
      "[SearchResultsPage] Link no encontrado",
      {
        event: "link_not_found",
        productName: productName,
        browser: browser,
      }
    );
    throw new Error("Link absoluto no encontrado.");
  }
}

module.exports = SearchResultsPage;
