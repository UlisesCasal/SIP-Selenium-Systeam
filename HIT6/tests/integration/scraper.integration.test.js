'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const ScraperConfig = require('../../src/config/ScraperConfig');
const { scrape } = require('../../src/scrapers/mercadolibre');
const { validateProducts } = require('../../src/utils/schema');

const runE2E = process.env.RUN_E2E === 'true';

(runE2E ? describe : describe.skip)('integración MercadoLibre HIT4', () => {
  it('ejecuta búsqueda, filtros, extracción y escritura JSON', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hit4-e2e-'));
    const config = new ScraperConfig({
      browser: process.env.BROWSER || 'chrome',
      headless: true,
      products: ['bicicleta rodado 29'],
      resultLimit: Number.parseInt(process.env.RESULT_LIMIT || '10', 10),
      maxRetries: Number.parseInt(process.env.MAX_RETRIES || '1', 10),
      explicitWait: Number.parseInt(process.env.EXPLICIT_WAIT_MS || '12000', 10),
      outputDir,
    });

    const summary = await scrape(config);
    expect(summary).toHaveLength(1);
    expect(fs.existsSync(summary[0].filePath)).toBe(true);

    const payload = JSON.parse(fs.readFileSync(summary[0].filePath, 'utf8'));
    expect(payload.length).toBeGreaterThanOrEqual(10);
    expect(validateProducts(payload)).toEqual([]);
  });
});
