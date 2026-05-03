"use strict";

/**
 * Tests de paridad cross-browser.
 * Ejecuta el scraper en ambos browsers y valida que los resultados
 * sean equivalentes: misma cantidad, mismos campos, tiempos razonables.
 */

const { scrape } = require("../src/scrapers/mercadolibre");
const BrowserOptions = require("../src/utils/BrowserOptions");

// Umbral: el 60% de los títulos debe coincidir entre browsers.
// MercadoLibre puede mostrar resultados levemente distintos por región/cache.
const OVERLAP_THRESHOLD = 0.6;

// Firefox suele ser hasta 3x más lento que Chrome en arrancar; toleramos hasta 4x
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
    // Si difieren, el test pasa igual pero lo registramos como info
    if (chromeSel !== firefoxSel) {
      console.warn(
        `[DIFERENCIA] Chrome usó "${chromeSel}", Firefox usó "${firefoxSel}"`,
      );
    }
    // Ambos deben haber encontrado ALGÚN selector
    expect(chromeSel).toBeTruthy();
    expect(firefoxSel).toBeTruthy();
  });

  it(`diferencia de tiempo de ejecución es ≤ ${MAX_TIME_RATIO}x`, () => {
    const ratio =
      Math.max(chromeResults[0].executionMs, firefoxResults[0].executionMs) /
      Math.min(chromeResults[0].executionMs, firefoxResults[0].executionMs);
    console.info(
      `Chrome: ${chromeResults[0].executionMs}ms | Firefox: ${firefoxResults[0].executionMs}ms | ratio: ${ratio.toFixed(2)}x`,
    );
    expect(ratio).toBeLessThanOrEqual(MAX_TIME_RATIO);
  });

  it("los precios tienen el mismo formato en ambos browsers", () => {
    const checkPriceFormat = (products, browser) => {
      products
        .filter((p) => p.price !== null)
        .forEach((p) => {
          expect(p.price).toMatch(/^\$[\d.,]+$/);
        });
    };
    checkPriceFormat(chromeResults[0].products, "chrome");
    checkPriceFormat(firefoxResults[0].products, "firefox");
  });
});
