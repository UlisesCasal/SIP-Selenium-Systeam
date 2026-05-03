#!/usr/bin/env node
"use strict";

/**
 * compare.js — Ejecuta el scraper en Chrome Y Firefox secuencialmente,
 * compara los resultados y genera un reporte HTML lado a lado.
 *
 * Uso:
 *   node src/scrapers/compare.js
 *   HEADLESS=true node src/scrapers/compare.js
 *   npm run compare:headless
 */

const BrowserOptions = require("../utils/BrowserOptions");
const { scrape } = require("./mercadolibre");
const { generateComparisonReport } = require("../utils/reporter");
const logger = require("../utils/logger");
const throttle = require("../utils/throttle");

async function main() {
  const headless =
    process.env.HEADLESS === "true" || process.argv.includes("--headless");

  logger.info("=".repeat(60));
  logger.info("MercadoLibre Cross-Browser Comparison — HIT #2");
  logger.info(`headless=${headless}`);
  logger.info("=".repeat(60));

  const chromeOpts = new BrowserOptions({ browser: "chrome", headless });
  const firefoxOpts = new BrowserOptions({ browser: "firefox", headless });

  // Ejecutar secuencialmente para no saturar al servidor ni la máquina
  logger.info("[1/2] Scraping Chrome...");
  const chromeResults = await scrape(chromeOpts);

  logger.info("Throttle 3s entre browsers...");
  await throttle(3000);

  logger.info("[2/2] Scraping Firefox...");
  const firefoxResults = await scrape(firefoxOpts);

  // Comparar el primer query (bicicleta rodado 29) de cada browser
  const { json, html } = generateComparisonReport(
    chromeResults[0],
    firefoxResults[0],
  );

  printSummary(chromeResults[0], firefoxResults[0]);

  logger.info("=".repeat(60));
  logger.info("Reporte generado:");
  logger.info(`  JSON: ${json}`);
  logger.info(`  HTML: ${html}`);
  logger.info("=".repeat(60));
}

function printSummary(chrome, firefox) {
  const chromeTitles = chrome.products.map((p) => p.title);
  const firefoxTitles = firefox.products.map((p) => p.title);
  const common = chromeTitles.filter((t) => firefoxTitles.includes(t));

  console.log("\n" + "=".repeat(60));
  console.log("COMPARACIÓN CHROME vs FIREFOX");
  console.log("=".repeat(60));
  console.log(
    `Chrome  — ${chrome.executionMs}ms — ${chrome.products.length} productos`,
  );
  console.log(
    `Firefox — ${firefox.executionMs}ms — ${firefox.products.length} productos`,
  );
  console.log(
    `Títulos en común: ${common.length}/${Math.max(chromeTitles.length, firefoxTitles.length)}`,
  );
  console.log("─".repeat(60));

  const maxLen = Math.max(chromeTitles.length, firefoxTitles.length);
  for (let i = 0; i < maxLen; i++) {
    const ct = chromeTitles[i] ?? "—";
    const ft = firefoxTitles[i] ?? "—";
    const match = ct === ft ? "✓" : "≠";
    console.log(`  ${i + 1}. [${match}] C: ${ct.slice(0, 50)}`);
    if (ct !== ft) {
      console.log(`       F: ${ft.slice(0, 50)}`);
    }
  }
  console.log("=".repeat(60) + "\n");
}

main().catch((err) => {
  logger.error(err.message);
  logger.error(err.stack);
  process.exit(1);
});
