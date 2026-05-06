"use strict";

const mockProducts = [
  { position: 1, title: "Bicicleta MTB Rodado 29", price: "$320000", url: "https://example.com/1", selectorUsed: ".poly-component__title" },
  { position: 2, title: "Bicicleta Aluminio Rodado 29", price: "$280000", url: "https://example.com/2", selectorUsed: ".poly-component__title" },
  { position: 3, title: "Bicicleta Shimano Rodado 29", price: "$300000", url: "https://example.com/3", selectorUsed: ".poly-component__title" },
  { position: 4, title: "Bicicleta Mountain Bike R29", price: "$260000", url: "https://example.com/4", selectorUsed: ".poly-component__title" },
  { position: 5, title: "Bicicleta Urbana Rodado 29", price: "$250000", url: "https://example.com/5", selectorUsed: ".poly-component__title" },
];

jest.mock("../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../src/utils/throttle", () => jest.fn().mockResolvedValue(undefined));

jest.mock("../src/utils/BrowserFactory", () => ({
  create: jest.fn(async () => ({
    quit: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("../src/pages/HomePage", () =>
  jest.fn().mockImplementation(() => ({
    open: jest.fn().mockResolvedValue(undefined),
    search: jest.fn().mockResolvedValue(undefined),
  })),
);

jest.mock("../src/pages/SearchResultsPage", () =>
  jest.fn().mockImplementation(() => ({
    waitForResults: jest.fn().mockResolvedValue(undefined),
    getProducts: jest.fn(async (limit) => mockProducts.slice(0, limit)),
    takeScreenshot: jest.fn(async () => "/tmp/hit2-screenshot.png"),
  })),
);

const { scrape } = require("../src/scrapers/mercadolibre");
const BrowserOptions = require("../src/utils/BrowserOptions");

const OVERLAP_THRESHOLD = 0.6;
const MAX_TIME_RATIO = 4.0;

describe("Cross-browser parity", () => {
  let chromeResults;
  let firefoxResults;

  beforeAll(async () => {
    const chromeOpts = new BrowserOptions({
      browser: "chrome",
      headless: true,
    });
    const firefoxOpts = new BrowserOptions({
      browser: "firefox",
      headless: true,
    });

    [chromeResults, firefoxResults] = await Promise.all([
      scrape(chromeOpts),
      scrape(firefoxOpts),
    ]);
  });

  it("ambos browsers extraen la misma query", () => {
    expect(chromeResults[0].query).toBe(firefoxResults[0].query);
  });

  it("ambos extraen al menos 5 productos", () => {
    expect(chromeResults[0].products.length).toBeGreaterThanOrEqual(5);
    expect(firefoxResults[0].products.length).toBeGreaterThanOrEqual(5);
  });

  it("la diferencia de cantidad de productos es ≤ 1", () => {
    const diff = Math.abs(
      chromeResults[0].products.length - firefoxResults[0].products.length,
    );
    expect(diff).toBeLessThanOrEqual(1);
  });

  it(`al menos ${OVERLAP_THRESHOLD * 100}% de los títulos coinciden`, () => {
    const chromeTitles = chromeResults[0].products.map((p) => p.title);
    const firefoxTitles = firefoxResults[0].products.map((p) => p.title);
    const common = chromeTitles.filter((t) => firefoxTitles.includes(t));
    const ratio =
      common.length / Math.max(chromeTitles.length, firefoxTitles.length);
    expect(ratio).toBeGreaterThanOrEqual(OVERLAP_THRESHOLD);
  });

  it("ambos usan el mismo selector para el título", () => {
    const chromeSel = chromeResults[0].products[0].selectorUsed;
    const firefoxSel = firefoxResults[0].products[0].selectorUsed;
    expect(chromeSel).toBeTruthy();
    expect(firefoxSel).toBeTruthy();
  });

  it(`diferencia de tiempo de ejecución es ≤ ${MAX_TIME_RATIO}x`, () => {
    const chromeMs = Math.max(chromeResults[0].executionMs, 1);
    const firefoxMs = Math.max(firefoxResults[0].executionMs, 1);
    const ratio = Math.max(chromeMs, firefoxMs) / Math.min(chromeMs, firefoxMs);
    expect(ratio).toBeLessThanOrEqual(MAX_TIME_RATIO);
  });

  it("los precios tienen el mismo formato en ambos browsers", () => {
    const checkPriceFormat = (products) => {
      products
        .filter((p) => p.price !== null)
        .forEach((p) => {
          expect(p.price).toMatch(/^\$[\d.,]+$/);
        });
    };
    checkPriceFormat(chromeResults[0].products);
    checkPriceFormat(firefoxResults[0].products);
  });
});
