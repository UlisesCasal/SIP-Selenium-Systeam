"use strict";

const { By, until } = require("selenium-webdriver");
const ProductParser = require("../parsers/ProductParser");
const logger = require("../utils/logger");

const ITEM_LOCATORS = [
  By.css("li.ui-search-layout__item"),
  By.css(".ui-search-results .ui-search-layout__item"),
  By.css(".poly-card"),
  By.css('[data-testid="result-card"]'),
];

const TITLE_SELECTORS = [
  "a.poly-component__title",
  ".poly-component__title",
  ".ui-search-item__title",
  "h2",
  '[data-testid="product-title"]',
];

const PRICE_SELECTORS = [
  ".poly-price__current .andes-money-amount__fraction",
  ".andes-money-amount__fraction",
  ".price-tag-fraction",
  '[aria-label*="pesos"]',
];

const OFFICIAL_STORE_SELECTORS = [
  ".ui-search-official-store-label",
  ".poly-component__seller",
  '[class*="official-store"]',
  '[class*="seller"]',
];

class SearchResultsPage {
  constructor(driver, explicitWait = 20000) {
    this.driver = driver;
    this.explicitWait = explicitWait;
    this.itemLocator = null;
  }

  async waitForResults() {
    for (const locator of ITEM_LOCATORS) {
      try {
        await this.driver.wait(
          until.elementLocated(locator),
          this.explicitWait,
        );
        this.itemLocator = locator;
        logger.info(`[SearchResultsPage] Resultados con ${locator.toString()}`);
        return;
      } catch {
        // probar siguiente selector
      }
    }
    throw new Error("No se encontraron resultados.");
  }

  async getProducts(limit = 10) {
    const items = await this._findItems();
    const products = [];
    const max = Math.min(limit, items.length);
    logger.info(
      `[SearchResultsPage] Extrayendo ${max}/${items.length} resultados`,
    );

    for (let index = 0; index < max; index++) {
      try {
        const item = items[index];
        const rawText = await item.getText();
        const title = await this._textFromSelectors(
          item,
          TITLE_SELECTORS,
          false,
        );
        const priceText = await this._textFromSelectors(
          item,
          PRICE_SELECTORS,
          false,
        );
        const link = await this._extractLink(item);
        const officialStoreText = await this._textFromSelectors(
          item,
          OFFICIAL_STORE_SELECTORS,
          true,
        );

        const product = ProductParser.toOutputProduct({
          title,
          priceText,
          link,
          rawText,
          officialStoreText,
        });

        products.push(product);
        logger.info(
          `[SearchResultsPage] ${index + 1}. ${product.titulo} | ${product.precio}`,
        );
      } catch (error) {
        logger.warn(
          `[SearchResultsPage] Producto ${index + 1} omitido: ${error.message}`,
        );
      }
    }

    return products;
  }

  async _findItems() {
    const locators = this.itemLocator
      ? [this.itemLocator, ...ITEM_LOCATORS]
      : ITEM_LOCATORS;
    for (const locator of locators) {
      const items = await this.driver.findElements(locator);
      if (items.length > 0) return items;
    }
    return [];
  }

  async _textFromSelectors(element, selectors, optional) {
    for (const selector of selectors) {
      try {
        const found = await element.findElement(By.css(selector));
        const text = ProductParser.normalizeText(await found.getText());
        if (text) return text;
        const aria = ProductParser.normalizeText(
          await found.getAttribute("aria-label"),
        );
        if (aria) return aria;
      } catch {
        // probar siguiente selector
      }
    }
    if (optional) return null;
    throw new Error(
      `Texto requerido no encontrado con selectores: ${selectors.join(", ")}`,
    );
  }

  async _extractLink(element) {
    for (const selector of [
      "a.poly-component__title",
      "a.ui-search-link",
      'a[href*="/"]',
      "a",
    ]) {
      try {
        const href = await element
          .findElement(By.css(selector))
          .getAttribute("href");
        if (href && /^https?:\/\//i.test(href)) return href;
      } catch {
        // probar siguiente selector
      }
    }
    throw new Error("Link absoluto no encontrado.");
  }
}

module.exports = SearchResultsPage;
