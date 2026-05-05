#!/usr/bin/env node
"use strict";

const ScraperConfig = require("../config/ScraperConfig");
const MercadoLibreScraper = require("./MercadoLibreScraper");
const logger = require("../utils/logger");

async function scrape(config = ScraperConfig.fromEnv()) {
  const scraper = new MercadoLibreScraper(config);
  return scraper.run();
}

async function main() {
  try {
    const config = ScraperConfig.fromEnv();
    logger.info("HIT #5 MercadoLibre multi-producto", {
      event: "scraper_start",
      browser: config.browser,
      headless: config.headless,
      resultLimit: config.resultLimit,
      products_count: config.products.length,
    });
    logger.info("Configuración cargada", {
      browser: config.browser,
      headless: config.headless,
      limit: config.resultLimit,
      products: config.products,
    });

    const summary = await scrape(config);
    if (summary && Array.isArray(summary)) {
      logger.info("Archivos generados", {
        event: "files_generated",
        summary: summary.map(item => ({
          query: item.query,
          path: item.filePath,
          count: item.products.length
        }))
      });
      logger.info("Scraping completado", {
        event: "scraper_complete",
        results_count: summary.length,
        total_products: summary.reduce((acc, item) => acc + item.products.length, 0),
      });
      logger.info("Scraping completado", {
        event: "scraper_complete",
        results_count: summary.length,
        total_products: summary.reduce((acc, item) => acc + item.products.length, 0),
      });
    } else {
      logger.warn("El scraper terminó pero no se generó un resumen válido.", {
        event: "no_summary",
      });
    }
  } catch (error) {
    logger.error("Scraper falló", {
      event: "scraper_failed",
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

/* istanbul ignore next */
if (require.main === module) {
  main();
}

module.exports = { scrape, main };
