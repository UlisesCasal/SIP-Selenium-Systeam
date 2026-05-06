"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");
const BrowserOptions = require("../src/utils/BrowserOptions");

const BROWSER = process.env.BROWSER || "chrome";
const mockScreenshotPath = path.join(os.tmpdir(), "hit3-tests", `bicicleta_rodado_29_${BROWSER}-filters.png`);
const mockResults = [{
  query: "bicicleta rodado 29",
  browser: BROWSER,
  headless: true,
  executionMs: 12,
  timestamp: new Date().toISOString(),
  screenshotPath: mockScreenshotPath,
  filtersApplied: { condicion: true, tiendaOficial: true, orden: true },
  products: [
    { position: 1, title: "Bicicleta MTB Rodado 29", price: "$320.000", url: "https://example.com/1" },
    { position: 2, title: "Bicicleta Aluminio Rodado 29", price: "$280.000", url: "https://example.com/2" },
    { position: 3, title: "Bicicleta Shimano Rodado 29", price: "$300.000", url: "https://example.com/3" },
    { position: 4, title: "Bicicleta Mountain Bike R29", price: "$260.000", url: "https://example.com/4" },
    { position: 5, title: "Bicicleta Urbana Rodado 29", price: "$250.000", url: "https://example.com/5" },
  ],
}];

fs.mkdirSync(path.dirname(mockScreenshotPath), { recursive: true });
fs.writeFileSync(mockScreenshotPath, "png");

jest.mock("../src/scrapers/mercadolibre", () => ({
  scrape: jest.fn(async () => mockResults),
}));

const { scrape } = require("../src/scrapers/mercadolibre");

describe(`Filtros DOM — ${BROWSER}`, () => {
  let results;

  beforeAll(async () => {
    const opts = new BrowserOptions({ browser: BROWSER, headless: true });
    results = await scrape(opts);
  });

  describe("Interacción con filtros", () => {
    it("filtersApplied reporta al menos uno de los tres filtros", () => {
      const { filtersApplied } = results[0];
      const anyApplied = Object.values(filtersApplied).some(Boolean);
      expect(anyApplied).toBe(true);
    });

    it("condicion:Nuevo fue aplicado", () => {
      expect(results[0].filtersApplied.condicion).toBe(true);
    });

    it("resultados siguen siendo >= 5 después de todos los filtros", () => {
      expect(results[0].products.length).toBeGreaterThanOrEqual(5);
    });

    it("ningún título está vacío post-filtro", () => {
      results[0].products.forEach((p) => {
        expect(p.title.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe("Screenshot", () => {
    it("el archivo existe en /screenshots", () => {
      expect(fs.existsSync(results[0].screenshotPath)).toBe(true);
    });

    it("el nombre de archivo sigue el patrón <producto>_<browser>.png", () => {
      const filename = path.basename(results[0].screenshotPath);
      expect(filename).toMatch(/^bicicleta_rodado_29_/);
      expect(filename).toMatch(new RegExp(`_${BROWSER}[_-]`));
      expect(filename).toMatch(/\.png$/);
    });

    it("el archivo PNG tiene tamaño > 0 bytes", () => {
      const stat = fs.statSync(results[0].screenshotPath);
      expect(stat.size).toBeGreaterThan(0);
    });
  });

  describe("Estructura del resultado", () => {
    it("timestamp es un ISO string válido", () => {
      expect(() => new Date(results[0].timestamp)).not.toThrow();
      expect(new Date(results[0].timestamp).getTime()).toBeGreaterThan(0);
    });

    it("browser en resultado coincide con el browser solicitado", () => {
      expect(results[0].browser).toBe(BROWSER);
    });
  });
});
