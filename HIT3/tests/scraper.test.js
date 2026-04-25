'use strict';

const { scrape } = require('../src/scrapers/mercadolibre');
const BrowserOptions = require('../src/utils/BrowserOptions');

const BROWSERS = process.env.BROWSER ? [process.env.BROWSER] : ['chrome', 'firefox'];

function assertProductSchema(product) {
  expect(product).toHaveProperty('position');
  expect(product).toHaveProperty('title');
  expect(product).toHaveProperty('price');
  expect(product).toHaveProperty('url');

  expect(typeof product.position).toBe('number');
  expect(product.position).toBeGreaterThanOrEqual(1);
  expect(typeof product.title).toBe('string');
  expect(product.title.trim().length).toBeGreaterThan(0);
  if (product.price !== null) {
    expect(product.price).toMatch(/^\$/);
  }
}

describe.each(BROWSERS)('Scraper con filtros — %s', (browserName) => {
  let results;

  beforeAll(async () => {
    const opts = new BrowserOptions({ browser: browserName, headless: true });
    results = await scrape(opts);
  });

  it('retorna resultados con browser y query correctos', () => {
    expect(results[0].browser).toBe(browserName);
    expect(results[0].query).toBe('bicicleta rodado 29');
  });

  it('extrae al menos 5 productos post-filtro', () => {
    expect(results[0].products.length).toBeGreaterThanOrEqual(5);
  });

  it('todos los productos cumplen el schema', () => {
    results[0].products.forEach(assertProductSchema);
  });

  it('posiciones consecutivas desde 1', () => {
    results[0].products.forEach((p, i) => expect(p.position).toBe(i + 1));
  });

  it('incluye el campo filtersApplied con las tres claves', () => {
    const { filtersApplied } = results[0];
    expect(filtersApplied).toHaveProperty('condicion');
    expect(filtersApplied).toHaveProperty('tiendaOficial');
    expect(filtersApplied).toHaveProperty('orden');
    expect(typeof filtersApplied.condicion).toBe('boolean');
    expect(typeof filtersApplied.tiendaOficial).toBe('boolean');
    expect(typeof filtersApplied.orden).toBe('boolean');
  });

  it('screenshot guardado con nombre <producto>_<browser>.png', () => {
    const fs = require('fs');
    const expectedPath = results[0].screenshotPath;
    expect(expectedPath).toMatch(/bicicleta_rodado_29_/);
    expect(expectedPath).toMatch(new RegExp(`${browserName}`));
    expect(expectedPath).toMatch(/\.png$/);
    expect(fs.existsSync(expectedPath)).toBe(true);
  });

  it('registra tiempo de ejecución', () => {
    expect(typeof results[0].executionMs).toBe('number');
    expect(results[0].executionMs).toBeGreaterThan(0);
  });
});
