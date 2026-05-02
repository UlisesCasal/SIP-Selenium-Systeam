'use strict';

const { scrape } = require('../src/scrapers/mercadolibre');

const SEARCH_QUERIES = ['Bicicleta rodado 29', 'iPhone 16 Pro Max', 'GeForce RTX 5090'];

function validateProductSchema(product) {
  expect(product).toHaveProperty('position');
  expect(product).toHaveProperty('title');
  expect(product).toHaveProperty('price');

  expect(typeof product.position).toBe('number');
  expect(product.position).toBeGreaterThanOrEqual(1);

  expect(typeof product.title).toBe('string');
  expect(product.title.trim().length).toBeGreaterThan(0);

  if (product.price !== null) {
    expect(typeof product.price).toBe('string');
  }
}

const BROWSERS = process.env.BROWSER
  ? [process.env.BROWSER]
  : ['chrome', 'firefox'];

describe.each(BROWSERS)('MercadoLibre Scraper — %s', (browser) => {
  let results;

  beforeAll(async () => {
    results = await scrape(browser, true);
  });

  it('debe retornar exactamente 3 resultados (uno por query)', () => {
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBe(3);
    results.forEach((r) => expect(r.browser).toBe(browser));
  });

  it.each(SEARCH_QUERIES)('debe retornar resultado para "%s"', (query) => {
    const result = results.find((r) => r.query === query);
    expect(result).toBeDefined();
    expect(result.query).toBe(query);
    expect(result.browser).toBe(browser);
  });

  it.each(SEARCH_QUERIES)('debe extraer entre 1 y 5 productos para "%s"', (query) => {
    const result = results.find((r) => r.query === query);
    // El scraper limita a 5; algunas queries pueden tener menos resultados disponibles
    expect(result.products.length).toBeGreaterThanOrEqual(1);
    expect(result.products.length).toBeLessThanOrEqual(5);
  });

  it.each(SEARCH_QUERIES)('cada producto de "%s" debe cumplir el schema', (query) => {
    const result = results.find((r) => r.query === query);
    result.products.forEach(validateProductSchema);
  });

  it.each(SEARCH_QUERIES)('posiciones consecutivas desde 1 en "%s"', (query) => {
    const result = results.find((r) => r.query === query);
    result.products.forEach((p, idx) => {
      expect(p.position).toBe(idx + 1);
    });
  });

  it.each(SEARCH_QUERIES)('no debe haber títulos duplicados en "%s"', (query) => {
    const result = results.find((r) => r.query === query);
    const titles = result.products.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it.each(SEARCH_QUERIES)('debe registrar tiempo de ejecución en "%s"', (query) => {
    const result = results.find((r) => r.query === query);
    expect(typeof result.executionMs).toBe('number');
    expect(result.executionMs).toBeGreaterThan(0);
  });
});
