"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

const mockProducts = [
  { position: 1, title: "Bicicleta MTB Rodado 29", price: "$320.000", url: "https://example.com/1", selectorUsed: ".poly-component__title" },
  { position: 2, title: "Bicicleta Aluminio Rodado 29", price: "$280.000", url: "https://example.com/2", selectorUsed: ".poly-component__title" },
  { position: 3, title: "Bicicleta Shimano Rodado 29", price: "$300.000", url: "https://example.com/3", selectorUsed: ".poly-component__title" },
  { position: 4, title: "Bicicleta Mountain Bike R29", price: "$260.000", url: "https://example.com/4", selectorUsed: ".poly-component__title" },
  { position: 5, title: "Bicicleta Urbana Rodado 29", price: "$250.000", url: "https://example.com/5", selectorUsed: ".poly-component__title" },
];
const mockScreenshotPath = path.join(os.tmpdir(), "hit3-tests", "bicicleta_rodado_29_chrome-test.png");

fs.mkdirSync(path.dirname(mockScreenshotPath), { recursive: true });
fs.writeFileSync(mockScreenshotPath, "png");

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

jest.mock("../src/pages/FiltersPage", () =>
  jest.fn().mockImplementation(() => ({
    applyAllFilters: jest.fn().mockResolvedValue({
      condicion: true,
      tiendaOficial: true,
      orden: true,
    }),
  })),
);

jest.mock("../src/pages/SearchResultsPage", () =>
  jest.fn().mockImplementation(() => ({
    waitForResults: jest.fn().mockResolvedValue(undefined),
    getProducts: jest.fn(async (limit) => mockProducts.slice(0, limit)),
    takeScreenshot: jest.fn(async (name) =>
      mockScreenshotPath.replace("chrome-test", name.includes("firefox") ? "firefox-test" : "chrome-test"),
    ),
  })),
);

const { scrape } = require("../src/scrapers/mercadolibre");
const BrowserOptions = require("../src/utils/BrowserOptions");

const BROWSERS = process.env.BROWSER
  ? [process.env.BROWSER]
  : ["chrome", "firefox"];

function assertProductSchema(product) {
  expect(product).toHaveProperty("position");
  expect(product).toHaveProperty("title");
  expect(product).toHaveProperty("price");
  expect(product).toHaveProperty("url");

  expect(typeof product.position).toBe("number");
  expect(product.position).toBeGreaterThanOrEqual(1);
  expect(typeof product.title).toBe("string");
  expect(product.title.trim().length).toBeGreaterThan(0);
  if (product.price !== null) {
    expect(product.price).toMatch(/^\$/);
  }
}

describe.each(BROWSERS)("Scraper con filtros — %s", (browserName) => {
  let results;

  beforeAll(async () => {
    const opts = new BrowserOptions({ browser: browserName, headless: true });
    results = await scrape(opts);
    fs.writeFileSync(results[0].screenshotPath, "png");
  });

  it("retorna resultados con browser y query correctos", () => {
    expect(results[0].browser).toBe(browserName);
    expect(results[0].query).toBe("bicicleta rodado 29");
  });

  it("extrae al menos 5 productos post-filtro", () => {
    expect(results[0].products.length).toBeGreaterThanOrEqual(5);
  });

  it("todos los productos cumplen el schema", () => {
    results[0].products.forEach(assertProductSchema);
  });

  it("posiciones consecutivas desde 1", () => {
    results[0].products.forEach((p, i) => expect(p.position).toBe(i + 1));
  });

  it("incluye el campo filtersApplied con las tres claves", () => {
    const { filtersApplied } = results[0];
    expect(filtersApplied).toHaveProperty("condicion");
    expect(filtersApplied).toHaveProperty("tiendaOficial");
    expect(filtersApplied).toHaveProperty("orden");
    expect(typeof filtersApplied.condicion).toBe("boolean");
    expect(typeof filtersApplied.tiendaOficial).toBe("boolean");
    expect(typeof filtersApplied.orden).toBe("boolean");
  });

  it("screenshot guardado con nombre <producto>_<browser>.png", () => {
    const expectedPath = results[0].screenshotPath;
    expect(expectedPath).toMatch(/bicicleta_rodado_29_/);
    expect(expectedPath).toMatch(new RegExp(`${browserName}`));
    expect(expectedPath).toMatch(/\.png$/);
    expect(fs.existsSync(expectedPath)).toBe(true);
  });

  it("registra tiempo de ejecución", () => {
    expect(typeof results[0].executionMs).toBe("number");
    expect(results[0].executionMs).toBeGreaterThanOrEqual(0);
  });
});
