#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const BrowserFactory = require('../utils/BrowserFactory');
const HomePage = require('../pages/HomePage');
const SearchResultsPage = require('../pages/SearchResultsPage');
const logger = require('../utils/logger');
const throttle = require('../utils/throttle');

// Productos objetivo del Hit #1
const SEARCH_QUERIES = ['Bicicleta rodado 29', 'iPhone 16 Pro Max', 'GeForce RTX 5090'];

/**
 * Ejecuta el scraper para un browser dado.
 *
 * @param {'chrome'|'firefox'} browserName
 * @param {boolean} headless
 * @returns {Promise<Array>} Resultados extraídos
 */
async function scrape(browserName = 'chrome', headless = false) {
  const startTime = Date.now();
  const allResults = [];

  for (const query of SEARCH_QUERIES) {
    logger.info(`${'─'.repeat(60)}`);
    logger.info(`Query: "${query}" | Browser: ${browserName}`);

    const result = await runQueryWithRetries(query, browserName, headless);
    allResults.push(result);

    // Throttle entre búsquedas para no saturar el servidor
    if (SEARCH_QUERIES.indexOf(query) < SEARCH_QUERIES.length - 1) {
      logger.info('Throttling 3s entre búsquedas...');
      await throttle(3000);
    }
  }

  const totalMs = Date.now() - startTime;
  logger.info(`${'─'.repeat(60)}`);
  logger.info(`Scraping finalizado en ${totalMs}ms | Browser: ${browserName}`);

  return allResults;
}

async function runQueryWithRetries(query, browserName, headless) {
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const driver = await BrowserFactory.create(browserName, headless);
    const queryStart = Date.now();

    try {
      const homePage = new HomePage(driver);
      const resultsPage = new SearchResultsPage(driver);

      await homePage.open();
      await homePage.search(query);
      await resultsPage.waitForResults();

      const products = await resultsPage.getProducts(5);
      const screenshotPath = await resultsPage.takeScreenshot(
        `${browserName}-${query.replace(/\s+/g, '_')}`
      );
      const elapsed = Date.now() - queryStart;

      logger.info(`Query "${query}" completada en ${elapsed}ms — ${products.length} productos`);

      return {
        query,
        browser: browserName,
        headless,
        executionMs: elapsed,
        timestamp: new Date().toISOString(),
        screenshot: screenshotPath,
        products,
      };
    } catch (err) {
      const message = (err && err.message) || '';
      const retriable =
        message.includes('account-verification') ||
        message.includes('No se encontró ningún resultado');

      logger.warn(
        `Intento ${attempt}/${MAX_ATTEMPTS} fallido para "${query}": ${message}`
      );

      if (!retriable) {
        throw err;
      }
      if (attempt === MAX_ATTEMPTS) {
        logger.warn(
          `Agotados los reintentos web para "${query}". Activando fallback API...`
        );
        const elapsed = Date.now() - queryStart;
        const products = await fetchProductsFromApi(query, 5);

        return {
          query,
          browser: browserName,
          headless,
          executionMs: elapsed,
          timestamp: new Date().toISOString(),
          screenshot: null,
          products,
        };
      }

      const backoffMs = attempt * 3000;
      logger.warn(`Reintentando "${query}" en ${backoffMs}ms...`);
      await throttle(backoffMs);
    } finally {
      await driver.quit();
      logger.info(`Driver ${browserName} cerrado`);
    }
  }
}

async function fetchProductsFromApi(query, limit = 5) {
  const url = `https://api.mercadolibre.com/sites/MLA/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fallback API devolvió ${response.status} para query "${query}"`);
  }

  const data = await response.json();
  const items = Array.isArray(data.results) ? data.results : [];
  const dedupTitles = new Set();
  const products = [];

  for (const item of items) {
    if (!item || !item.title) continue;
    if (dedupTitles.has(item.title)) continue;
    dedupTitles.add(item.title);

    products.push({
      position: products.length + 1,
      title: String(item.title).trim(),
      price: item.price !== undefined && item.price !== null ? `$${item.price}` : null,
      url: item.permalink || null,
    });

    if (products.length >= limit) break;
  }

  if (products.length === 0) {
    throw new Error(`Fallback API sin resultados para "${query}"`);
  }

  logger.info(`Fallback API ok para "${query}" — ${products.length} productos`);
  return products;
}

/**
 * Guarda los resultados como JSON y genera un reporte HTML básico.
 */
function saveResults(results, browserName) {
  const resultsDir = path.join(__dirname, '../../results');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(resultsDir, `results-${browserName}-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
  logger.info(`Resultados guardados en: ${jsonPath}`);

  // Reporte HTML legible para GitHub Pages
  const htmlPath = path.join(resultsDir, `report-${browserName}-${timestamp}.html`);
  const html = generateHtmlReport(results, browserName);
  fs.writeFileSync(htmlPath, html, 'utf-8');
  logger.info(`Reporte HTML generado en: ${htmlPath}`);

  return { jsonPath, htmlPath };
}

function generateHtmlReport(results, browserName) {
  const rows = results.flatMap((r) =>
    r.products.map(
      (p) => `
      <tr>
        <td>${r.browser}</td>
        <td>${r.query}</td>
        <td>${p.position}</td>
        <td>${p.title}</td>
        <td>${p.price ?? 'N/A'}</td>
        <td>${r.executionMs}ms</td>
      </tr>`
    )
  );

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>MercadoLibre Scraper — HIT #1</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 0.5rem 1rem; text-align: left; }
    th { background: #f0f0f0; }
    tr:nth-child(even) { background: #fafafa; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>MercadoLibre Scraper — HIT #1</h1>
  <p>Browser: <strong>${browserName}</strong> | Generado: ${new Date().toISOString()}</p>
  <table>
    <thead>
      <tr>
        <th>Browser</th><th>Query</th><th>Pos.</th><th>Título</th><th>Precio</th><th>Tiempo</th>
      </tr>
    </thead>
    <tbody>${rows.join('')}</tbody>
  </table>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────
// Entry point cuando se ejecuta directamente
// ──────────────────────────────────────────────────────────
async function main() {
  const browserArg = process.env.BROWSER || process.argv[2] || 'chrome';
  const headless = process.argv.includes('--headless') || process.env.HEADLESS === 'true';

  logger.info('='.repeat(60));
  logger.info('MercadoLibre Scraper — HIT #1');
  logger.info(`Browser: ${browserArg} | Headless: ${headless}`);
  logger.info('='.repeat(60));

  try {
    const results = await scrape(browserArg, headless);
    saveResults(results, browserArg);

    // Mostrar primeros 5 títulos en consola (requerimiento del hit)
    console.log('\n' + '='.repeat(60));
    console.log(`Primeros 5 productos — "${results[0].query}"`);
    console.log('='.repeat(60));
    results[0].products.forEach((p) => {
      console.log(`  ${p.position}. ${p.title}`);
    });
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
