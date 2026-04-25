'use strict';

const { scrape } = require('../src/scrapers/mercadolibre');

// Schema esperado para cada producto
function validateProductSchema(product) {
  expect(product).toHaveProperty('position');
  expect(product).toHaveProperty('title');
  expect(product).toHaveProperty('price');

  expect(typeof product.position).toBe('number');
  expect(product.position).toBeGreaterThanOrEqual(1);

  expect(typeof product.title).toBe('string');
  expect(product.title.trim().length).toBeGreaterThan(0);

  // price puede ser string o null
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
    results = await scrape(browser, true); // headless en tests
  });

  it('debe retornar resultados para "bicicleta rodado 29"', () => {
    expect(results).toBeInstanceOf(Array);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].query).toBe('bicicleta rodado 29');
    expect(results[0].browser).toBe(browser);
  });

  it('debe extraer al menos 5 productos', () => {
    expect(results[0].products.length).toBeGreaterThanOrEqual(5);
  });

  it('cada producto debe cumplir el schema esperado', () => {
    results[0].products.forEach(validateProductSchema);
  });

  it('las posiciones deben ser consecutivas desde 1', () => {
    const positions = results[0].products.map((p) => p.position);
    positions.forEach((pos, idx) => {
      expect(pos).toBe(idx + 1);
    });
  });

  it('no debe haber títulos duplicados entre los primeros 5', () => {
    const titles = results[0].products.map((p) => p.title);
    const unique = new Set(titles);
    expect(unique.size).toBe(titles.length);
  });

  it('debe registrar el tiempo de ejecución en ms', () => {
    expect(typeof results[0].executionMs).toBe('number');
    expect(results[0].executionMs).toBeGreaterThan(0);
  });
});
