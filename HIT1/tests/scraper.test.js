"use strict";

let mockActiveQuery = null;

const mockProductsByQuery = {
  "Bicicleta rodado 29": [
    { position: 1, title: "Bicicleta MTB Rodado 29", price: "$320000", url: "https://example.com/bici" },
    { position: 2, title: "Bicicleta Aluminio Rodado 29", price: "$280000", url: "https://example.com/bici-2" },
  ],
  "iPhone 16 Pro Max": [
    { position: 1, title: "Apple iPhone 16 Pro Max 256 GB", price: "$2700000", url: "https://example.com/iphone" },
  ],
  "GeForce RTX 5090": [
    { position: 1, title: "Placa De Video GeForce RTX 5090", price: "$11000000", url: "https://example.com/rtx" },
  ],
};

jest.mock("../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../src/utils/throttle", () => jest.fn().mockResolvedValue(undefined));

jest.mock("../src/utils/BrowserFactory", () => ({
  create: jest.fn(async (browser) => ({
    browser,
    quit: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("../src/pages/HomePage", () =>
  jest.fn().mockImplementation(() => ({
    open: jest.fn().mockResolvedValue(undefined),
    search: jest.fn(async (query) => {
      mockActiveQuery = query;
    }),
  })),
);

jest.mock("../src/pages/SearchResultsPage", () =>
  jest.fn().mockImplementation(() => ({
    waitForResults: jest.fn().mockResolvedValue(undefined),
    getProducts: jest.fn(async (limit) => mockProductsByQuery[mockActiveQuery].slice(0, limit)),
    takeScreenshot: jest.fn(async () => "/tmp/screenshot.png"),
  })),
);

const { scrape } = require("../src/scrapers/mercadolibre");

const SEARCH_QUERIES = [
  "Bicicleta rodado 29",
  "iPhone 16 Pro Max",
  "GeForce RTX 5090",
];

function validateProductSchema(product) {
  expect(product).toHaveProperty("position");
  expect(product).toHaveProperty("title");
  expect(product).toHaveProperty("price");

  expect(typeof product.position).toBe("number");
  expect(product.position).toBeGreaterThanOrEqual(1);

  expect(typeof product.title).toBe("string");
  expect(product.title.trim().length).toBeGreaterThan(0);

  if (product.price !== null) {
    expect(typeof product.price).toBe("string");
  }
}

const BROWSERS = process.env.BROWSER
  ? [process.env.BROWSER]
  : ["chrome", "firefox"];

describe.each(BROWSERS)("MercadoLibre Scraper — %s", (browser) => {
  let results;

  beforeAll(async () => {
    results = await scrape(browser, true);
  });

  it("debe retornar exactamente 3 resultados (uno por query)", () => {
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

  it.each(SEARCH_QUERIES)(
    'debe extraer entre 1 y 5 productos para "%s"',
    (query) => {
      const result = results.find((r) => r.query === query);
      expect(result.products.length).toBeGreaterThanOrEqual(1);
      expect(result.products.length).toBeLessThanOrEqual(5);
    },
  );

  it.each(SEARCH_QUERIES)(
    'cada producto de "%s" debe cumplir el schema',
    (query) => {
      const result = results.find((r) => r.query === query);
      result.products.forEach(validateProductSchema);
    },
  );

  it.each(SEARCH_QUERIES)(
    'posiciones consecutivas desde 1 en "%s"',
    (query) => {
      const result = results.find((r) => r.query === query);
      result.products.forEach((p, idx) => {
        expect(p.position).toBe(idx + 1);
      });
    },
  );

  it.each(SEARCH_QUERIES)(
    'no debe haber títulos duplicados en "%s"',
    (query) => {
      const result = results.find((r) => r.query === query);
      const titles = result.products.map((p) => p.title);
      expect(new Set(titles).size).toBe(titles.length);
    },
  );

  it.each(SEARCH_QUERIES)(
    'debe registrar tiempo de ejecución en "%s"',
    (query) => {
      const result = results.find((r) => r.query === query);
      expect(typeof result.executionMs).toBe("number");
      expect(result.executionMs).toBeGreaterThanOrEqual(0);
    },
  );
});
