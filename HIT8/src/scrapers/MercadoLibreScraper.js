'use strict';

const BrowserFactory = require('../utils/BrowserFactory');
const logger = require('../utils/logger');
const { retry, sleep } = require('../utils/retry');
const { calculateStats, formatPriceStats } = require('../utils/stats');
const HomePage = require('../pages/HomePage');
const FiltersPage = require('../pages/FiltersPage');
const SearchResultsPage = require('../pages/SearchResultsPage');
const JsonWriter = require('../writers/JsonWriter');
const PostgresWriter = require('../writers/PostgresWriter');

class MercadoLibreScraper {
  constructor(config, {
    browserFactory = BrowserFactory,
    writer = new JsonWriter({ outputDir: config.outputDir, logger }),
    pgWriter = new PostgresWriter(),
  } = {}) {
    this.config = config;
    this.browserFactory = browserFactory;
    this.writer = writer;
    this.pgWriter = pgWriter;
    this._pgEnabled = process.env.POSTGRES_ENABLED === 'true';
  }

  async run() {
    const driver = await this.browserFactory.create(this.config.browser, this.config.headless);
    const summary = [];

    if (this._pgEnabled) {
      await this.pgWriter.connect();
    }

    try {
      for (const product of this.config.products) {
        const result = await retry(
          () => this.scrapeProduct(driver, product),
          {
            retries: this.config.maxRetries,
            delayMs: 2000,
            label: `scrape:${product} [${this.config.browser}]`,
            logger,
          }
        );
        const filePath = this.writer.write(product, result.products);
        summary.push({ ...result, filePath });
        this._printPriceStats(product, result.products);

        if (this._pgEnabled) {
          await this.pgWriter.write(product, result.products);
        }

        await sleep(1000);
      }
    } finally {
      await driver.quit();
      if (this._pgEnabled) await this.pgWriter.close();
      logger.info('[MercadoLibreScraper] Browser cerrado.');
    }

    return summary;
  }

  _printPriceStats(product, products) {
    const stats = calculateStats(products);
    if (stats.min === 0 && stats.max === 0) {
      logger.warn(`[MercadoLibreScraper] Sin precios válidos para "${product}"`);
      return;
    }

    const separator = '='.repeat(70);
    const header = `Estadísticas de precio para "${product}" (${products.length} resultados)`;
    
    const table = [
      separator,
      header,
      separator,
      formatPriceStats(stats),
      separator,
    ].join('\n');

    logger.info(`\n${table}`);

    if (this.writer && typeof this.writer.writeStats === 'function') {
      this.writer.writeStats(product, { ...stats, count: products.length });
    }
  }

  async scrapeProduct(driver, product) {
    const startedAt = Date.now();
    logger.info('='.repeat(70));
    logger.info(`[MercadoLibreScraper] Producto: "${product}"`);

    const home = new HomePage(driver, this.config.explicitWait);
    const filters = new FiltersPage(driver, this.config.explicitWait);
    const results = new SearchResultsPage(driver, this.config.explicitWait);

    await home.open();
    await home.search(product);
    await this._waitForResultsOrDirectSearch(driver, results, product);

    let filtersApplied = { condicion: false, tiendaOficial: false, orden: false };
    if (this.config.applyFilters) {
      filtersApplied = await filters.applyAllFilters();
      await results.waitForResults();
    }

    const products = await results.getProducts(this.config.resultLimit, product, this.config.browser);
    if (products.length === 0) {
      throw new Error(`No se extrajeron productos para "${product}".`);
    }

    const executionMs = Date.now() - startedAt;
    logger.info(`[MercadoLibreScraper] "${product}" listo: ${products.length} resultados en ${executionMs}ms`);

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
      const directUrl = `https://listado.mercadolibre.com.ar/${encodeURIComponent(product.trim().replace(/\s+/g, '-'))}`;
      logger.warn(`[MercadoLibreScraper] Búsqueda inicial sin resultados (${error.message}). Fallback: ${directUrl}`);
      await driver.get(directUrl);
      await resultsPage.waitForResults();
    }
  }
}

module.exports = MercadoLibreScraper;
