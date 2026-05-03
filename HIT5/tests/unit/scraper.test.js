"use strict";

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../../src/pages/HomePage", () => jest.fn().mockImplementation(() => ({
  open: jest.fn().mockResolvedValue(undefined),
  search: jest.fn().mockResolvedValue(undefined),
})));

jest.mock("../../src/pages/FiltersPage", () => jest.fn().mockImplementation(() => ({
  applyAllFilters: jest.fn().mockResolvedValue({ condicion: true, tiendaOficial: true, orden: true }),
})));

jest.mock("../../src/pages/SearchResultsPage", () => jest.fn().mockImplementation(() => ({
  waitForResults: jest.fn().mockResolvedValue(undefined),
  getProducts: jest.fn().mockResolvedValue([{
    titulo: "Bicicleta",
    precio: 100,
    link: "https://example.com/bici",
    tienda_oficial: null,
    envio_gratis: true,
    cuotas_sin_interes: null,
  }]),
})));

jest.mock("../../src/utils/retry", () => ({
  retry: jest.fn((operation) => operation()),
  sleep: jest.fn().mockResolvedValue(undefined),
}));

const MercadoLibreScraper = require("../../src/scrapers/MercadoLibreScraper");
const { retry, sleep } = require("../../src/utils/retry");
const FiltersPage = require("../../src/pages/FiltersPage");
const SearchResultsPage = require("../../src/pages/SearchResultsPage");

function config(overrides = {}) {
  return {
    browser: "chrome",
    headless: true,
    products: ["bicicleta rodado 29"],
    outputDir: "/tmp",
    maxRetries: 1,
    explicitWait: 50,
    applyFilters: true,
    resultLimit: 2,
    ...overrides,
  };
}

describe("MercadoLibreScraper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("ejecuta productos, escribe JSON y cierra el browser", async () => {
    const driver = { quit: jest.fn().mockResolvedValue(undefined) };
    const browserFactory = {
      create: jest.fn().mockResolvedValue(driver),
    };
    const writer = {
      write: jest.fn().mockReturnValue("/tmp/bicicleta.json"),
    };
    const scraper = new MercadoLibreScraper(config(), { browserFactory, writer });

    await expect(scraper.run()).resolves.toEqual([
      expect.objectContaining({
        query: "bicicleta rodado 29",
        filePath: "/tmp/bicicleta.json",
      }),
    ]);

    expect(browserFactory.create).toHaveBeenCalledWith("chrome", true);
    expect(retry).toHaveBeenCalled();
    expect(writer.write).toHaveBeenCalledWith("bicicleta rodado 29", expect.any(Array));
    expect(sleep).toHaveBeenCalledWith(1000);
    expect(driver.quit).toHaveBeenCalled();
  });

  it("scrapea sin filtros cuando la configuración los desactiva", async () => {
    const scraper = new MercadoLibreScraper(config({ applyFilters: false }), {
      browserFactory: { create: jest.fn() },
      writer: { write: jest.fn() },
    });

    const result = await scraper.scrapeProduct({}, "iphone");

    expect(result.filtersApplied).toEqual({ condicion: false, tiendaOficial: false, orden: false });
    expect(FiltersPage.mock.results[0].value.applyAllFilters).not.toHaveBeenCalled();
    expect(SearchResultsPage.mock.results[0].value.getProducts).toHaveBeenCalledWith(2, "iphone", "chrome");
  });

  it("falla cuando no se extraen productos", async () => {
    SearchResultsPage.mockImplementationOnce(() => ({
      waitForResults: jest.fn().mockResolvedValue(undefined),
      getProducts: jest.fn().mockResolvedValue([]),
    }));
    const scraper = new MercadoLibreScraper(config(), {
      browserFactory: { create: jest.fn() },
      writer: { write: jest.fn() },
    });

    await expect(scraper.scrapeProduct({}, "notebook")).rejects.toThrow(/No se extrajeron/);
  });

  it("usa búsqueda directa como fallback si la primera espera falla", async () => {
    const resultsPage = {
      waitForResults: jest
        .fn()
        .mockRejectedValueOnce(new Error("sin resultados"))
        .mockResolvedValueOnce(undefined),
    };
    const driver = {
      get: jest.fn().mockResolvedValue(undefined),
    };
    const scraper = new MercadoLibreScraper(config(), {
      browserFactory: { create: jest.fn() },
      writer: { write: jest.fn() },
    });

    await scraper._waitForResultsOrDirectSearch(driver, resultsPage, "iPhone 16 Pro Max");

    expect(driver.get).toHaveBeenCalledWith("https://listado.mercadolibre.com.ar/iPhone-16-Pro-Max");
    expect(resultsPage.waitForResults).toHaveBeenCalledTimes(2);
  });
});
