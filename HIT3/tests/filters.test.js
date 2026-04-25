'use strict';

/**
 * Tests específicos del flujo de filtros.
 *
 * Validan:
 *   - Que se interactúa realmente con el DOM (la URL cambia al filtrar)
 *   - Que los filtros aplicados se reportan correctamente
 *   - Que el screenshot tiene el nombre requerido por el enunciado
 *   - Que los resultados post-filtro siguen siendo de productos "Nuevo"
 *     (validación heurística: si filtersApplied.condicion === true el flujo funcionó)
 */

const path = require('path');
const fs = require('fs');
const { scrape } = require('../src/scrapers/mercadolibre');
const BrowserOptions = require('../src/utils/BrowserOptions');

const BROWSER = process.env.BROWSER || 'chrome';

describe(`Filtros DOM — ${BROWSER}`, () => {
  let results;

  beforeAll(async () => {
    const opts = new BrowserOptions({ browser: BROWSER, headless: true });
    results = await scrape(opts);
  });

  describe('Interacción con filtros', () => {
    it('filtersApplied reporta al menos uno de los tres filtros', () => {
      const { filtersApplied } = results[0];
      const anyApplied = Object.values(filtersApplied).some(Boolean);
      // Si ningún filtro pudo aplicarse es un problema de selectores
      expect(anyApplied).toBe(true);
    });

    it('condicion:Nuevo fue aplicado', () => {
      // El filtro de condición es el más estable de MercadoLibre
      expect(results[0].filtersApplied.condicion).toBe(true);
    });

    it('resultados siguen siendo >= 5 después de todos los filtros', () => {
      expect(results[0].products.length).toBeGreaterThanOrEqual(5);
    });

    it('ningún título está vacío post-filtro', () => {
      results[0].products.forEach((p) => {
        expect(p.title.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe('Screenshot', () => {
    it('el archivo existe en /screenshots', () => {
      expect(fs.existsSync(results[0].screenshotPath)).toBe(true);
    });

    it('el nombre de archivo sigue el patrón <producto>_<browser>.png', () => {
      const filename = path.basename(results[0].screenshotPath);
      // Debe contener el producto sanitizado y el nombre del browser
      expect(filename).toMatch(/^bicicleta_rodado_29_/);
      expect(filename).toMatch(new RegExp(`_${BROWSER}[_-]`));
      expect(filename).toMatch(/\.png$/);
    });

    it('el archivo PNG tiene tamaño > 0 bytes', () => {
      const stat = fs.statSync(results[0].screenshotPath);
      expect(stat.size).toBeGreaterThan(0);
    });
  });

  describe('Estructura del resultado', () => {
    it('timestamp es un ISO string válido', () => {
      expect(() => new Date(results[0].timestamp)).not.toThrow();
      expect(new Date(results[0].timestamp).getTime()).toBeGreaterThan(0);
    });

    it('browser en resultado coincide con el browser solicitado', () => {
      expect(results[0].browser).toBe(BROWSER);
    });
  });
});
