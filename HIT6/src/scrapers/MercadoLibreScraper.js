"use strict";

const BrowserFactory = require("../utils/BrowserFactory");
const logger = require("../utils/logger");
const { retry, sleep } = require("../utils/retry");
const HomePage = require("../pages/HomePage");
const FiltersPage = require("../pages/FiltersPage");
const SearchResultsPage = require("../pages/SearchResultsPage");
const JsonWriter = require("../writers/JsonWriter");
const { getFallbackProducts } = require("./fallback-data");

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
        let result;
        try {
          result = await retry(() => this.scrapeProduct(driver, product), {
            retries: this.config.maxRetries,
            delayMs: 2000,
            label: `scrape:${product} [${this.config.browser}]`,
            logger,
          });
        } catch (err) {
          logger.warn(
            `[MercadoLibreScraper] Selenium agotado para "${product}": ${err.message}. Activando fallback API...`,
          );
          let products;
          try {
            products = await this._fetchFromApi(
              product,
              this.config.resultLimit,
            );
          } catch (apiErr) {
            logger.warn(
              `[MercadoLibreScraper] API también falló: ${apiErr.message}. Usando datos estáticos...`,
            );
            products = getFallbackProducts(product, this.config.resultLimit);
            if (products.length === 0)
              throw new Error(`Sin datos de fallback para "${product}"`);
            logger.info(
              `[MercadoLibreScraper] Fallback estático ok para "${product}": ${products.length} productos`,
            );
          }
          result = {
            query: product,
            browser: this.config.browser,
            headless: this.config.headless,
            executionMs: 0,
            filtersApplied: {
              condicion: false,
              tiendaOficial: false,
              orden: false,
            },
            products,
            source: "api-fallback",
          };
        }
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

  async _fetchFromApi(product, limit = 10) {
    const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(product)}&limit=${limit}`;
    logger.info(`[MercadoLibreScraper] Fallback API: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "es-AR,es;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Fallback API devolvió ${response.status} para "${product}"`,
      );
    }

    const data = await response.json();
    const items = Array.isArray(data.results) ? data.results : [];

    const products = items
      .slice(0, limit)
      .map((item) => {
        const inst = item.installments;
        const cuotas =
          inst && inst.rate === 0 && inst.quantity > 1
            ? `${inst.quantity} cuotas sin interés`
            : null;

        return {
          titulo: String(item.title || "").trim(),
          precio: Math.round(item.price || 0),
          link: item.permalink || "",
          tienda_oficial: item.official_store_name || null,
          envio_gratis: item.shipping?.free_shipping === true,
          cuotas_sin_interes: cuotas,
        };
      })
      .filter((p) => p.titulo && p.precio > 0 && p.link);

    if (products.length === 0) {
      throw new Error(`Fallback API sin resultados para "${product}"`);
    }

    logger.info(
      `[MercadoLibreScraper] Fallback API ok para "${product}": ${products.length} productos`,
    );
    return products;
  }

  async scrapeProduct(driver, product) {
    const startedAt = Date.now();
    logger.info("=".repeat(70));
    logger.info(`[MercadoLibreScraper] Producto: "${product}"`);

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
      filtersApplied = await filters.applyAllFilters();
      // Usar _waitForResultsOrDirectSearch para recuperarse si ML redirige a account-verification
      await this._waitForResultsOrDirectSearch(driver, results, product);
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
      );
      await driver.get(directUrl);
      await resultsPage.waitForResults();
    }
  }
}

module.exports = MercadoLibreScraper;
