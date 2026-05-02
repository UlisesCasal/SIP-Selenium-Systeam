#!/usr/bin/env node
'use strict';

const ScraperConfig = require('../config/ScraperConfig');
const MercadoLibreScraper = require('./MercadoLibreScraper');
const logger = require('../utils/logger');

async function scrape(config = ScraperConfig.fromEnv()) {
  const scraper = new MercadoLibreScraper(config);
  return scraper.run();
}

async function main() {
  try {
    const config = ScraperConfig.fromEnv();
    logger.info('HIT #5 MercadoLibre multi-producto');
    logger.info(`browser=${config.browser} headless=${config.headless} limit=${config.resultLimit}`);
    logger.info(`productos=${config.products.join(' | ')}`);

    const summary = await scrape(config);
    if (summary && Array.isArray(summary)) {
      console.log('\nArchivos generados:');
      summary.forEach((item) => {
          console.log(`- ${item.query}: ${item.filePath} (${item.products.length} resultados)`);
    }); 
    } else {
        logger.warn('El scraper terminó pero no se generó un resumen válido.');
    }
  } catch (error) {
    logger.error(`Scraper falló: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { scrape };
