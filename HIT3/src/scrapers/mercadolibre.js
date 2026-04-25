#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const BrowserFactory = require('../utils/BrowserFactory');
const BrowserOptions = require('../utils/BrowserOptions');
const HomePage = require('../pages/HomePage');
const SearchResultsPage = require('../pages/SearchResultsPage');
const FiltersPage = require('../pages/FiltersPage');
const logger = require('../utils/logger');
const throttle = require('../utils/throttle');

// QUERY env var permite probar distintos productos desde CLI:
//   QUERY="iPhone 16 Pro Max" node src/scrapers/mercadolibre.js
const SEARCH_QUERIES = process.env.QUERY
  ? [process.env.QUERY]
  : ['bicicleta rodado 29'];

/**
 * Ejecuta el scraper completo: búsqueda → filtros DOM → extracción.
 *
 * @param {BrowserOptions|object} options
 * @returns {Promise<Array>}
 */
async function scrape(options = {}) {
  const opts = options instanceof BrowserOptions ? options : new BrowserOptions(options);
  const startTime = Date.now();
  const driver = await BrowserFactory.create(opts);
  const allResults = [];

  try {
    const homePage = new HomePage(driver, opts.explicitWait);
    const resultsPage = new SearchResultsPage(driver, opts.explicitWait);
    const filtersPage = new FiltersPage(driver, opts.explicitWait);

    for (const query of SEARCH_QUERIES) {
      logger.info('─'.repeat(60));
      logger.info(`Query: "${query}" | ${opts}`);

      const queryStart = Date.now();

      // ── 1. Búsqueda inicial ──────────────────────────────────────────────
      await homePage.open();
      await homePage.search(query);
      await resultsPage.waitForResults();
      logger.info('Resultados iniciales cargados');

      // ── 2. Aplicación de filtros via clicks DOM ──────────────────────────
      const filtersApplied = await filtersPage.applyAllFilters();

      // ── 3. Extracción post-filtro ────────────────────────────────────────
      const products = await resultsPage.getProducts(5);

      // ── 4. Screenshot con naming requerido: <producto>_<browser>.png ─────
      const screenshotName = `${query.replace(/\s+/g, '_')}_${opts.browser}`;
      const screenshotPath = await resultsPage.takeScreenshot(screenshotName);

      const elapsed = Date.now() - queryStart;
      logger.info(`"${query}" → ${products.length} productos en ${elapsed}ms`);

      allResults.push({
        query,
        browser: opts.browser,
        headless: opts.headless,
        executionMs: elapsed,
        timestamp: new Date().toISOString(),
        screenshotPath,
        filtersApplied,
        products,
      });

      if (SEARCH_QUERIES.indexOf(query) < SEARCH_QUERIES.length - 1) {
        await throttle(2000);
      }
    }

    logger.info('─'.repeat(60));
    logger.info(`Total: ${Date.now() - startTime}ms | ${opts.browser}`);
    return allResults;
  } finally {
    await driver.quit();
    logger.info(`Driver ${opts.browser} cerrado`);
  }
}

function saveResults(results, browserName) {
  const dir = path.join(__dirname, '../../results');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(dir, `results-${browserName}-${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
  logger.info(`JSON guardado: ${jsonPath}`);
  return jsonPath;
}

// ── Entry point ─────────────────────────────────────────────────────────────
async function main() {
  const opts = BrowserOptions.fromCli();

  logger.info('='.repeat(60));
  logger.info('MercadoLibre Scraper con Filtros — HIT #3');
  logger.info(opts.toString());
  logger.info('='.repeat(60));

  try {
    const results = await scrape(opts);
    saveResults(results, opts.browser);

    const r = results[0];
    console.log('\n' + '='.repeat(60));
    console.log(`Filtros aplicados: ${JSON.stringify(r.filtersApplied)}`);
    console.log(`Primeros 5 productos filtrados [${opts.browser}]`);
    console.log('='.repeat(60));
    r.products.forEach((p) => console.log(`  ${p.position}. ${p.title}`));
    console.log(`Screenshot: ${r.screenshotPath}`);
    console.log('='.repeat(60) + '\n');
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
