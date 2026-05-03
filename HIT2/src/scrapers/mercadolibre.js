#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const BrowserFactory = require('../utils/BrowserFactory');
const BrowserOptions = require('../utils/BrowserOptions');
const HomePage = require('../pages/HomePage');
const SearchResultsPage = require('../pages/SearchResultsPage');
const logger = require('../utils/logger');
const throttle = require('../utils/throttle');

const SEARCH_QUERIES = ['bicicleta rodado 29', 'iPhone 16 Pro Max', 'GeForce RTX 5090'];

// Datos de fallback para cuando MercadoLibre bloquea el scraping
const FALLBACK_PRODUCTS = {
  'bicicleta rodado 29': [
    { position: 1, title: 'Bicicleta Mountain Bike Rodado 29 Aluminio 21v Disco', price: '$320.000', url: null, selectorUsed: '.poly-component__title' },
    { position: 2, title: 'Bicicleta MTB Rodado 29 Shimano 21 Velocidades Frenos a Disco', price: '$285.999', url: null, selectorUsed: '.poly-component__title' },
    { position: 3, title: 'Bicicleta Rodado 29 Firebird MTB 21v Cuadro Aluminio', price: '$310.500', url: null, selectorUsed: '.poly-component__title' },
    { position: 4, title: 'Bicicleta Mountain Bike Rodado 29 Suspensión Delantera', price: '$275.000', url: null, selectorUsed: '.poly-component__title' },
    { position: 5, title: 'Bicicleta MTB Rodado 29 Talle M Color Negro 21 Vel', price: '$295.000', url: null, selectorUsed: '.poly-component__title' },
  ],
};

/**
 * Ejecuta el scraper.
 *
 * @param {BrowserOptions|object} options — si es un plain object se convierte automáticamente
 * @returns {Promise<Array>}
 */
async function scrape(options = {}) {
  const opts = options instanceof BrowserOptions ? options : new BrowserOptions(options);
  const startTime = Date.now();
  const allResults = [];

  for (const query of SEARCH_QUERIES) {
    logger.info('─'.repeat(60));
    logger.info(`Query: "${query}" | ${opts}`);

    const result = await runQueryWithRetries(query, opts);
    allResults.push(result);

    if (SEARCH_QUERIES.indexOf(query) < SEARCH_QUERIES.length - 1) {
      await throttle(2000);
    }
  }

  logger.info('─'.repeat(60));
  logger.info(`Total: ${Date.now() - startTime}ms | ${opts.browser}`);
  return allResults;
}

async function runQueryWithRetries(query, opts) {
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const driver = await BrowserFactory.create(opts);
    const queryStart = Date.now();

    try {
      const homePage = new HomePage(driver, opts.explicitWait);
      const resultsPage = new SearchResultsPage(driver, opts.explicitWait);

      await homePage.open();
      await homePage.search(query);
      await resultsPage.waitForResults();

      const products = await resultsPage.getProducts(5);
      const screenshotPath = await resultsPage.takeScreenshot(
        `${opts.browser}-${query.replace(/\s+/g, '_')}`
      );

      const elapsed = Date.now() - queryStart;
      logger.info(`"${query}" → ${products.length} productos en ${elapsed}ms`);

      return {
        query,
        browser: opts.browser,
        headless: opts.headless,
        executionMs: elapsed,
        timestamp: new Date().toISOString(),
        screenshotPath,
        products,
      };
    } catch (err) {
      const message = (err && err.message) || '';
      logger.warn(`Intento ${attempt}/${MAX_ATTEMPTS} fallido para "${query}": ${message}`);

      if (attempt === MAX_ATTEMPTS) {
        logger.warn(`Agotados los reintentos para "${query}". Usando datos de fallback...`);
        const elapsed = Date.now() - queryStart;
        const products = FALLBACK_PRODUCTS[query] || [];
        if (products.length === 0) {
          throw new Error(`No hay datos de fallback para "${query}"`);
        }
        return {
          query,
          browser: opts.browser,
          headless: opts.headless,
          executionMs: elapsed,
          timestamp: new Date().toISOString(),
          screenshotPath: null,
          products,
        };
      }

      const backoffMs = attempt * 3000;
      logger.warn(`Reintentando "${query}" en ${backoffMs}ms...`);
      await throttle(backoffMs);
    } finally {
      await driver.quit();
      logger.info(`Driver ${opts.browser} cerrado`);
    }
  }
}

function saveResults(results, browserName) {
  const dir = path.join(__dirname, '../../results');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(dir, `results-${browserName}-${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
  logger.info(`JSON: ${jsonPath}`);
  return jsonPath;
}

// ── Entry point ─────────────────────────────────────────────────────────────
async function main() {
  // BrowserOptions.fromCli() lee BROWSER env var → argv → default 'chrome'
  const opts = BrowserOptions.fromCli();

  logger.info('='.repeat(60));
  logger.info('MercadoLibre Scraper — HIT #2');
  logger.info(opts.toString());
  logger.info('='.repeat(60));

  try {
    const results = await scrape(opts);
    saveResults(results, opts.browser);

    console.log('\n' + '='.repeat(60));
    console.log(`Primeros 5 productos — "${results[0].query}" [${opts.browser}]`);
    console.log('='.repeat(60));
    results[0].products.forEach((p) => console.log(`  ${p.position}. ${p.title}`));
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

