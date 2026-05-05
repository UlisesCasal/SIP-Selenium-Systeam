"use strict";

const BrowserFactory = require("../utils/BrowserFactory");
const logger = require("../utils/logger");
const { retry, sleep } = require("../utils/retry");
const HomePage = require("../pages/HomePage");
const FiltersPage = require("../pages/FiltersPage");
const SearchResultsPage = require("../pages/SearchResultsPage");
const JsonWriter = require("../writers/JsonWriter");

class MercadoLibreScraper {
  constructor(
    config,
    {
      browserFactory = BrowserFactory,
      writer = new JsonWriter({ outputDir: config.outputDir, logger }),
    } = {},
  ) {
    this.config = config;
    this.browserFactory = browserFactory;
    this.writer = writer;
  }

  async run() {
    const driver = await this.browserFactory.create(
      this.config.browser,
      this.config.headless,
    );
    const summary = [];

    try {
      for (const product of this.config.products) {
        const result = await retry(() => this.scrapeProduct(driver, product), {
          retries: this.config.maxRetries,
          delayMs: 2000,
          factor: 2,
          label: `scrape:${product} [${this.config.browser}]`,
          logger,
        });
        const filePath = this.writer.write(product, result.products);
        summary.push({ ...result, filePath });
        await sleep(1000);
      }
    } finally {
      await driver.quit();
      logger.info("[MercadoLibreScraper] Browser cerrado.");
    }

    return summary;
  }

  async scrapeProduct(driver, product) {
    const startedAt = Date.now();
    logger.info("=".repeat(70));
    logger.info(`[MercadoLibreScraper] Producto: "${product}"`, { producto: product });

    const home = new HomePage(driver, this.config.explicitWait);
    const filters = new FiltersPage(driver, this.config.explicitWait);
    const results = new SearchResultsPage(driver, this.config.explicitWait);

    await home.open();
    await home.search(product);
    await this._waitForResultsOrDirectSearch(driver, results, product);

    let filtersApplied = {
      condicion: false,
      tiendaOficial: false,
      orden: false,
    };
    if (this.config.applyFilters) {
      filtersApplied = await filters.applyAllFilters(product);
      await results.waitForResults();
    }

    const products = await results.getProducts(
      this.config.resultLimit,
      product,
      this.config.browser,
    );
    if (products.length === 0) {
      throw new Error(`No se extrajeron productos para "${product}".`);
    }

    const executionMs = Date.now() - startedAt;
    logger.info(
      `[MercadoLibreScraper] "${product}" listo: ${products.length} resultados en ${executionMs}ms`,
      { producto: product }
    );

    return {
      query: product,
      browser: this.config.browser,
      headless: this.config.headless,
      executionMs,
      filtersApplied,
      products,
    };
  }

  async _waitForResultsOrDirectSearch(driver, resultsPage, product) {
    try {
      await resultsPage.waitForResults();
    } catch (error) {
      const directUrl = `https://listado.mercadolibre.com.ar/${encodeURIComponent(product.trim().replace(/\s+/g, "-"))}`;
      logger.warn(
        `[MercadoLibreScraper] Búsqueda inicial sin resultados (${error.message}). Fallback: ${directUrl}`,
        { producto: product }
      );
      await driver.get(directUrl);
      await resultsPage.waitForResults();
    }
  }
}

module.exports = MercadoLibreScraper;
