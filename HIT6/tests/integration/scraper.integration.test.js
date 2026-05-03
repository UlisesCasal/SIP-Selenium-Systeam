'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const ScraperConfig = require('../../src/config/ScraperConfig');
const { scrape } = require('../../src/scrapers/mercadolibre');
const { validateProducts } = require('../../src/utils/schema');
const { DEFAULT_PRODUCTS } = require('../../src/config/products');

const runE2E = process.env.RUN_E2E === 'true';

(runE2E ? describe : describe.skip)('integración MercadoLibre HIT6', () => {
  it('ejecuta búsqueda, filtros, extracción y escritura JSON para los 3 productos', async () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hit6-e2e-'));
    const config = new ScraperConfig({
      browser: process.env.BROWSER || 'chrome',
      headless: true,
      products: DEFAULT_PRODUCTS,
      resultLimit: Number.parseInt(process.env.RESULT_LIMIT || '10', 10),
      maxRetries: Number.parseInt(process.env.MAX_RETRIES || '1', 10),
      explicitWait: Number.parseInt(process.env.EXPLICIT_WAIT_MS || '12000', 10),
      outputDir,
    });

    const summary = await scrape(config);
    expect(summary).toHaveLength(DEFAULT_PRODUCTS.length);

    for (const result of summary) {
      expect(fs.existsSync(result.filePath)).toBe(true);

      const payload = JSON.parse(fs.readFileSync(result.filePath, 'utf8'));
      expect(payload.length).toBeGreaterThanOrEqual(10);

      expect(validateProducts(payload)).toEqual([]);

      payload.forEach((product) => {
        expect(typeof product.precio).toBe('number');
        expect(product.precio).toBeGreaterThan(0);
      });

      payload.forEach((product) => {
        expect(product.link).toMatch(/^https?:\/\//i);
      });
    }
  });
});
