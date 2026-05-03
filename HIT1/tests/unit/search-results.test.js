'use strict';

const fs = require('fs');
const path = require('path');

describe('SearchResultsPage', () => {
  let SearchResultsPage;
  let mockDriver;

  beforeEach(() => {
    jest.resetModules();
    SearchResultsPage = require('../../src/pages/SearchResultsPage');

    mockDriver = {
      wait: jest.fn(),
      executeScript: jest.fn(),
      getCurrentUrl: jest.fn().mockResolvedValue('https://listado.mercadolibre.com.ar/bicicleta'),
      getTitle: jest.fn().mockResolvedValue('Bicicleta | MercadoLibre'),
      takeScreenshot: jest.fn().mockResolvedValue('base64screenshotdata'),
      findElement: jest.fn(),
      findElements: jest.fn().mockResolvedValue([]),
    };
  });

  it('constructor inicializa el driver', () => {
    const page = new SearchResultsPage(mockDriver);
    expect(page.driver).toBe(mockDriver);
  });

  describe('waitForResults', () => {
    it('resuelve cuando encuentra resultados via executeScript', async () => {
      // Primer wait (document.readyState) - resuelve
      mockDriver.wait
        .mockResolvedValueOnce(true)   // readyState
        .mockResolvedValueOnce(true);  // items encontrados

      const page = new SearchResultsPage(mockDriver);
      await page.waitForResults();
      // No debe lanzar error
    });

    it('lanza error cuando no encuentra resultados', async () => {
      // readyState ok
      mockDriver.wait
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);  // items no encontrados -> catch -> false

      // Simular el wait que devuelve false (timeout)
      mockDriver.wait.mockImplementation((fn, timeout) => {
        if (typeof fn === 'function') {
          // Para readyState
          return Promise.resolve(true);
        }
        return Promise.resolve(true);
      });

      // Hacemos que el segundo wait devuelva false (simulando timeout)
      let callCount = 0;
      mockDriver.wait.mockImplementation(async (fnOrCondition, timeout) => {
        callCount++;
        if (callCount === 1) return true; // readyState
        // Segundo wait: simula timeout al no encontrar items
        throw new Error('timeout');
      });

      mockDriver.executeScript.mockResolvedValue('li: 0 | a: 0');

      const page = new SearchResultsPage(mockDriver);
      await expect(page.waitForResults()).rejects.toThrow(
        'No se encontró ningún resultado en la página'
      );
    });
  });

  describe('getProducts', () => {
    it('retorna productos extraídos via executeScript', async () => {
      const mockProducts = [
        { position: 1, title: 'Bicicleta MTB 29', price: '$300.000', url: 'https://example.com' },
        { position: 2, title: 'Bicicleta Road 29', price: '$250.000', url: null },
      ];
      mockDriver.executeScript.mockResolvedValue(mockProducts);

      const page = new SearchResultsPage(mockDriver);
      const products = await page.getProducts(5);
      expect(products).toEqual(mockProducts);
      expect(products.length).toBe(2);
    });

    it('retorna array vacío cuando no hay productos', async () => {
      mockDriver.executeScript.mockResolvedValue([]);

      const page = new SearchResultsPage(mockDriver);
      const products = await page.getProducts(5);
      expect(products).toEqual([]);
    });

    it('pasa el límite al executeScript', async () => {
      mockDriver.executeScript.mockResolvedValue([]);

      const page = new SearchResultsPage(mockDriver);
      await page.getProducts(10);
      expect(mockDriver.executeScript).toHaveBeenCalledWith(
        expect.any(Function),
        10
      );
    });
  });

  describe('takeScreenshot', () => {
    it('toma un screenshot y lo guarda en /screenshots', async () => {
      mockDriver.takeScreenshot.mockResolvedValue('base64data');

      const page = new SearchResultsPage(mockDriver);
      const filePath = await page.takeScreenshot('test-screenshot');

      expect(filePath).toContain('test-screenshot');
      expect(filePath).toContain('.png');
      expect(fs.existsSync(filePath)).toBe(true);

      // Limpiar
      fs.unlinkSync(filePath);
    });

    it('crea el directorio screenshots si no existe', async () => {
      mockDriver.takeScreenshot.mockResolvedValue('data');

      const page = new SearchResultsPage(mockDriver);
      const filePath = await page.takeScreenshot('test-mkdir');

      expect(fs.existsSync(filePath)).toBe(true);

      // Limpiar
      fs.unlinkSync(filePath);
    });
  });
});
