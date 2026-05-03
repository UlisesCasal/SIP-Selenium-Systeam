"use strict";

jest.mock("../../src/utils/BrowserFactory");
jest.mock("../../src/pages/HomePage");
jest.mock("../../src/pages/FiltersPage");
jest.mock("../../src/pages/SearchResultsPage");

const MercadoLibreScraper = require("../../src/scrapers/MercadoLibreScraper");

const FAKE_PRODUCT = {
  titulo: "Producto Test",
  precio: 100000,
  link: "https://www.mercadolibre.com.ar/p/TEST1",
  tienda_oficial: null,
  envio_gratis: true,
  cuotas_sin_interes: null,
};

const makeConfig = (overrides = {}) => ({
  browser: "chrome",
  headless: true,
  products: ["bicicleta rodado 29"],
  resultLimit: 10,
  maxRetries: 0,
  explicitWait: 5000,
  outputDir: "/tmp/hit6-test",
  applyFilters: false,
  ...overrides,
});

const makeBrowserFactory = () => ({
  create: jest
    .fn()
    .mockResolvedValue({ quit: jest.fn().mockResolvedValue(undefined) }),
});

const makeWriter = () => ({
  write: jest.fn().mockReturnValue("/tmp/hit6-test/output.json"),
});

describe("MercadoLibreScraper", () => {
  describe("_fetchFromApi", () => {
    let scraper;

    beforeEach(() => {
      scraper = new MercadoLibreScraper(makeConfig(), {
        browserFactory: makeBrowserFactory(),
        writer: makeWriter(),
      });
    });

    it("devuelve productos mapeados al schema de HIT6 cuando la API responde 200", async () => {
      const apiItem = {
        title: "Bicicleta Test",
        price: 250000,
        permalink: "https://www.mercadolibre.com.ar/p/MLA999",
        official_store_name: null,
        shipping: { free_shipping: true },
        installments: { quantity: 12, amount: 20833, rate: 0 },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: [apiItem] }),
      });

      const products = await scraper._fetchFromApi("bicicleta rodado 29", 10);

      expect(products).toHaveLength(1);
      expect(products[0]).toMatchObject({
        titulo: "Bicicleta Test",
        precio: 250000,
        link: "https://www.mercadolibre.com.ar/p/MLA999",
        tienda_oficial: null,
        envio_gratis: true,
        cuotas_sin_interes: "12 cuotas sin interés",
      });
    });

    it("lanza error cuando la API devuelve 403", async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });

      await expect(
        scraper._fetchFromApi("bicicleta rodado 29", 10),
      ).rejects.toThrow("Fallback API devolvió 403");
    });

    it("filtra items sin título o precio", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: [
            {
              title: "",
              price: 100,
              permalink: "https://a.com",
              shipping: {},
              installments: null,
            },
            {
              title: "Válido",
              price: 0,
              permalink: "https://b.com",
              shipping: {},
              installments: null,
            },
            {
              title: "Válido",
              price: 100,
              permalink: "https://c.com",
              shipping: { free_shipping: false },
              installments: null,
            },
          ],
        }),
      });

      const products = await scraper._fetchFromApi("test", 10);
      expect(products).toHaveLength(1);
      expect(products[0].titulo).toBe("Válido");
    });

    it("lanza error cuando la API no devuelve resultados", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: [] }),
      });

      await expect(scraper._fetchFromApi("test", 10)).rejects.toThrow(
        "Fallback API sin resultados",
      );
    });
  });

  describe("run() — cadena de fallback", () => {
    it("usa datos estáticos cuando Selenium y API fallan", async () => {
      const browserFactory = makeBrowserFactory();
      const writer = makeWriter();
      const scraper = new MercadoLibreScraper(makeConfig({ maxRetries: 0 }), {
        browserFactory,
        writer,
      });

      // Selenium falla
      jest
        .spyOn(scraper, "scrapeProduct")
        .mockRejectedValue(new Error("bot detected"));
      // API falla
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });

      const summary = await scraper.run();

      expect(summary).toHaveLength(1);
      expect(summary[0].source).toBe("api-fallback");
      expect(summary[0].products.length).toBeGreaterThan(0);
    });

    it("usa la API cuando Selenium falla y la API responde", async () => {
      const browserFactory = makeBrowserFactory();
      const writer = makeWriter();
      const scraper = new MercadoLibreScraper(makeConfig({ maxRetries: 0 }), {
        browserFactory,
        writer,
      });

      jest
        .spyOn(scraper, "scrapeProduct")
        .mockRejectedValue(new Error("timeout"));
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: [
            {
              title: "Bici",
              price: 100000,
              permalink: "https://x.com",
              shipping: { free_shipping: false },
              installments: null,
            },
          ],
        }),
      });

      const summary = await scraper.run();

      expect(summary[0].source).toBe("api-fallback");
      expect(summary[0].products[0].titulo).toBe("Bici");
    });

    it("escribe el JSON y retorna el filePath", async () => {
      const browserFactory = makeBrowserFactory();
      const writer = makeWriter();
      const scraper = new MercadoLibreScraper(makeConfig({ maxRetries: 0 }), {
        browserFactory,
        writer,
      });

      jest
        .spyOn(scraper, "scrapeProduct")
        .mockRejectedValue(new Error("timeout"));
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });

      const summary = await scraper.run();

      expect(writer.write).toHaveBeenCalledWith(
        "bicicleta rodado 29",
        expect.any(Array),
      );
      expect(summary[0].filePath).toBe("/tmp/hit6-test/output.json");
    });
  });
});
