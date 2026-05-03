"use strict";

const { scrape } = require("../src/scrapers/mercadolibre");
const BrowserOptions = require("../src/utils/BrowserOptions");

const BROWSERS = process.env.BROWSER
  ? [process.env.BROWSER]
  : ["chrome", "firefox"];

// Schema esperado por producto
function assertProductSchema(product) {
  expect(product).toHaveProperty("position");
  expect(product).toHaveProperty("title");
  expect(product).toHaveProperty("price");
  expect(product).toHaveProperty("url");
  expect(product).toHaveProperty("selectorUsed"); // nuevo en HIT2

  expect(typeof product.position).toBe("number");
  expect(product.position).toBeGreaterThanOrEqual(1);

  expect(typeof product.title).toBe("string");
  expect(product.title.trim().length).toBeGreaterThan(0);

  if (product.price !== null) {
    expect(typeof product.price).toBe("string");
    expect(product.price).toMatch(/^\$/);
  }
}

describe.each(BROWSERS)("Scraper — %s", (browserName) => {
  let results;

  beforeAll(async () => {
    const opts = new BrowserOptions({ browser: browserName, headless: true });
    results = await scrape(opts);
  });

  it("retorna array con al menos un resultado", () => {
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("el resultado tiene browser y query correctos", () => {
    expect(results[0].browser).toBe(browserName);
    expect(results[0].query).toBe("bicicleta rodado 29");
  });

  it("extrae al menos 5 productos", () => {
    expect(results[0].products.length).toBeGreaterThanOrEqual(5);
  });

  it("todos los productos cumplen el schema", () => {
    results[0].products.forEach(assertProductSchema);
  });

  it("las posiciones son 1, 2, 3, 4, 5 en orden", () => {
    const positions = results[0].products.map((p) => p.position);
    positions.forEach((pos, idx) => expect(pos).toBe(idx + 1));
  });

  it("no hay títulos duplicados", () => {
    const titles = results[0].products.map((p) => p.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("registra el tiempo de ejecución", () => {
    expect(typeof results[0].executionMs).toBe("number");
    expect(results[0].executionMs).toBeGreaterThan(0);
  });

  it("registra el selector utilizado para el título", () => {
    results[0].products.forEach((p) => {
      expect(typeof p.selectorUsed).toBe("string");
      expect(p.selectorUsed.length).toBeGreaterThan(0);
    });
  });
});
