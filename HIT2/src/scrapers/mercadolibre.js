#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const BrowserFactory = require("../utils/BrowserFactory");
const BrowserOptions = require("../utils/BrowserOptions");
const HomePage = require("../pages/HomePage");
const SearchResultsPage = require("../pages/SearchResultsPage");
const logger = require("../utils/logger");
const throttle = require("../utils/throttle");

const SEARCH_QUERIES = ["bicicleta rodado 29"];

/**
 * Ejecuta el scraper.
 *
 * @param {BrowserOptions|object} options — si es un plain object se convierte automáticamente
 * @returns {Promise<Array>}
 */
async function scrape(options = {}) {
  const opts =
    options instanceof BrowserOptions ? options : new BrowserOptions(options);
  const startTime = Date.now();
  const driver = await BrowserFactory.create(opts);
  const allResults = [];

  try {
    const homePage = new HomePage(driver, opts.explicitWait);
    const resultsPage = new SearchResultsPage(driver, opts.explicitWait);

    for (const query of SEARCH_QUERIES) {
      logger.info("─".repeat(60));
      logger.info(`Query: "${query}" | ${opts}`);

      const queryStart = Date.now();

      await homePage.open();
      await homePage.search(query);
      await resultsPage.waitForResults();

      const products = await resultsPage.getProducts(5);
      const screenshotPath = await resultsPage.takeScreenshot(
        `${opts.browser}-${query.replace(/\s+/g, "_")}`,
      );

      const elapsed = Date.now() - queryStart;
      logger.info(`"${query}" → ${products.length} productos en ${elapsed}ms`);

      allResults.push({
        query,
        browser: opts.browser,
        headless: opts.headless,
        executionMs: elapsed,
        timestamp: new Date().toISOString(),
        screenshotPath,
        products,
      });

      if (SEARCH_QUERIES.indexOf(query) < SEARCH_QUERIES.length - 1) {
        await throttle(2000);
      }
    }

    logger.info("─".repeat(60));
    logger.info(`Total: ${Date.now() - startTime}ms | ${opts.browser}`);
    return allResults;
  } finally {
    await driver.quit();
    logger.info(`Driver ${opts.browser} cerrado`);
  }
}

function saveResults(results, browserName) {
  const dir = path.join(__dirname, "../../results");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(dir, `results-${browserName}-${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf-8");
  logger.info(`JSON: ${jsonPath}`);
  return jsonPath;
}

// ── Entry point ─────────────────────────────────────────────────────────────
async function main() {
  // BrowserOptions.fromCli() lee BROWSER env var → argv → default 'chrome'
  const opts = BrowserOptions.fromCli();

  logger.info("=".repeat(60));
  logger.info("MercadoLibre Scraper — HIT #2");
  logger.info(opts.toString());
  logger.info("=".repeat(60));

  try {
    const results = await scrape(opts);
    saveResults(results, opts.browser);

    console.log("\n" + "=".repeat(60));
    console.log(
      `Primeros 5 productos — "${results[0].query}" [${opts.browser}]`,
    );
    console.log("=".repeat(60));
    results[0].products.forEach((p) =>
      console.log(`  ${p.position}. ${p.title}`),
    );
    console.log("=".repeat(60) + "\n");
  } catch (err) {
    logger.error(`Scraping fallido: ${err.message}`);
    logger.error(err.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { scrape };
