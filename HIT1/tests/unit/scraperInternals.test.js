"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  fetchProductsFromApi,
  generateHtmlReport,
  saveResults,
} = require("../../src/scrapers/mercadolibre");

describe("scraper internals", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete global.fetch;
  });

  it("normaliza productos desde la API y elimina títulos duplicados", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        results: [
          { title: "Producto A", price: 10, permalink: "https://example.com/a" },
          { title: "Producto A", price: 10, permalink: "https://example.com/a2" },
          { title: "Producto B", price: null, permalink: null },
          { title: "", price: 20 },
        ],
      }),
    });

    const products = await fetchProductsFromApi("test", 5);

    expect(products).toEqual([
      { position: 1, title: "Producto A", price: "$10", url: "https://example.com/a" },
      { position: 2, title: "Producto B", price: null, url: null },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("q=test"),
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("falla si la API devuelve error o resultados vacíos", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(fetchProductsFromApi("sin permiso")).rejects.toThrow(/403/);

    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({ results: [] }),
    });
    await expect(fetchProductsFromApi("sin resultados")).rejects.toThrow(/sin resultados/);
  });

  it("genera reporte HTML con los productos", () => {
    const html = generateHtmlReport([
      {
        browser: "chrome",
        query: "Bicicleta",
        executionMs: 12,
        products: [{ position: 1, title: "Bici", price: "$100" }],
      },
    ], "chrome");

    expect(html).toContain("MercadoLibre Scraper");
    expect(html).toContain("<td>Bici</td>");
    expect(html).toContain("<strong>chrome</strong>");
  });

  it("guarda JSON y HTML en el directorio results", () => {
    fs.mkdtempSync(path.join(os.tmpdir(), "hit1-results-"));
    const mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);
    const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false);

    try {
      const saved = saveResults([
        {
          browser: "firefox",
          query: "iPhone",
          executionMs: 1,
          products: [{ position: 1, title: "iPhone", price: "$1" }],
        },
      ], "firefox");

      expect(saved.jsonPath).toContain("results-firefox-");
      expect(saved.htmlPath).toContain("report-firefox-");
      expect(mkdirSpy).toHaveBeenCalledWith(expect.stringContaining("results"), { recursive: true });
      expect(writeSpy).toHaveBeenCalledTimes(2);
    } finally {
      existsSpy.mockRestore();
      mkdirSpy.mockRestore();
      writeSpy.mockRestore();
    }
  });

  it("usa datos cacheados cuando la web y la API quedan bloqueadas", async () => {
    jest.resetModules();
    const quit = jest.fn().mockResolvedValue(undefined);
    jest.doMock("../../src/utils/logger", () => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    }));
    jest.doMock("../../src/utils/BrowserFactory", () => ({
      create: jest.fn().mockResolvedValue({ quit }),
    }));
    jest.doMock("../../src/utils/throttle", () => jest.fn().mockResolvedValue(undefined));
    jest.doMock("../../src/pages/HomePage", () =>
      jest.fn().mockImplementation(() => ({
        open: jest.fn().mockResolvedValue(undefined),
        search: jest.fn().mockRejectedValue(
          new Error("MercadoLibre bloqueó la búsqueda con account-verification"),
        ),
      })),
    );
    jest.doMock("../../src/pages/SearchResultsPage", () =>
      jest.fn().mockImplementation(() => ({
        waitForResults: jest.fn(),
        getProducts: jest.fn(),
        takeScreenshot: jest.fn(),
      })),
    );
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });

    const { runQueryWithRetries } = require("../../src/scrapers/mercadolibre");
    const result = await runQueryWithRetries("GeForce RTX 5090", "chrome", true);

    expect(result.products).toHaveLength(1);
    expect(result.screenshot).toBeNull();
    expect(quit).toHaveBeenCalledTimes(3);
  });
});
