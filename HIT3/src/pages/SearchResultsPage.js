"use strict";

const { By, until } = require("selenium-webdriver");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

// Selectores multi-fallback (Polaris "poly-*" → versión anterior "ui-search-*")
const ITEM_LOCATORS = [
  By.css("li.ui-search-layout__item"),
  By.css(".ui-search-results .ui-search-layout__item"),
  By.css(".poly-card"),
];

const TITLE_SELECTORS = [
  ".poly-component__title",
  ".ui-search-item__title",
  "h2.poly-box",
  ".ui-search-item__group__element h2",
];

const PRICE_SELECTORS = [
  ".poly-price__current .andes-money-amount__fraction",
  ".andes-money-amount__fraction",
  ".price-tag-fraction",
];

/**
 * Page Object — Página de resultados de búsqueda de MercadoLibre.
 * Registra qué selector funcionó para facilitar la comparación entre browsers.
 */
class SearchResultsPage {
  /**
   * @param {import('selenium-webdriver').WebDriver} driver
   * @param {number} explicitWait — ms máximos para explicit waits
   */
  constructor(driver, explicitWait = 20000) {
    this.driver = driver;
    this.explicitWait = explicitWait;
    this._workingItemLocator = null; // se registra al encontrar items
  }

  async waitForResults() {
    logger.info("Waiting for search results...");
    let found = false;

    for (const locator of ITEM_LOCATORS) {
      try {
        await this.driver.wait(
          until.elementLocated(locator),
          this.explicitWait,
        );
        this._workingItemLocator = locator;
        found = true;
        logger.info(`Items found with: ${locator.toString()}`);
        break;
      } catch {
        // probar siguiente
      }
    }

    if (!found) throw new Error("No search results found on page");

    // Explicit wait: al menos el primer item debe ser visible
    try {
      const first = await this.driver.findElement(this._workingItemLocator);
      await this.driver.wait(until.elementIsVisible(first), 5000);
    } catch {
      // continuar si el wait de visibilidad falla (el item ya puede estar visible)
    }

    logger.info("Results are visible");
  }

  /**
   * @param {number} limit
   * @returns {Promise<Array<{position,title,price,url,selectorUsed}>>}
   */
  async getProducts(limit = 5) {
    const locator = this._workingItemLocator || ITEM_LOCATORS[0];
    let items = await this.driver.findElements(locator);

    if (items.length === 0) {
      logger.warn("0 items found — retrying with all locators");
      for (const loc of ITEM_LOCATORS) {
        items = await this.driver.findElements(loc);
        if (items.length > 0) break;
      }
    }

    if (items.length === 0) {
      logger.warn("No product items found");
      return [];
    }

    logger.info(
      `Extracting ${Math.min(limit, items.length)} of ${items.length} items`,
    );
    const products = [];

    for (let i = 0; i < Math.min(limit, items.length); i++) {
      try {
        const { text: title, selector: titleSel } = await this._extractWithMeta(
          items[i],
          TITLE_SELECTORS,
        );
        const { text: priceRaw } = await this._extractWithMeta(
          items[i],
          PRICE_SELECTORS,
          true,
        );
        const url = await this._extractLink(items[i]);

        const product = {
          position: i + 1,
          title,
          price: priceRaw ? `$${priceRaw}` : null,
          url,
          selectorUsed: titleSel, // dato útil para el informe de diferencias
        };

        products.push(product);
        logger.info(`[${i + 1}] ${title} | ${product.price ?? "sin precio"}`);
      } catch (err) {
        logger.error(`Error en producto ${i + 1}: ${err.message}`);
      }
    }

    return products;
  }

  async takeScreenshot(name) {
    const dir = path.join(__dirname, "../../screenshots");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = path.join(dir, `${name}-${ts}.png`);
    const data = await this.driver.takeScreenshot();
    fs.writeFileSync(filePath, data, "base64");
    logger.info(`Screenshot: ${filePath}`);
    return filePath;
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  async _extractWithMeta(element, selectors, optional = false) {
    for (const selector of selectors) {
      try {
        const el = await element.findElement(By.css(selector));
        const text = (await el.getText()).trim();
        if (text) return { text, selector };
      } catch {
        // siguiente
      }
    }
    if (!optional)
      throw new Error(`Text not found with: ${selectors.join(", ")}`);
    return { text: null, selector: null };
  }

  async _extractLink(element) {
    for (const sel of [
      "a.poly-component__title",
      "a.ui-search-item__group__element",
      "a",
    ]) {
      try {
        const href = await element
          .findElement(By.css(sel))
          .getAttribute("href");
        if (href) return href;
      } catch {
        // siguiente
      }
    }
    return null;
  }
}

module.exports = SearchResultsPage;
