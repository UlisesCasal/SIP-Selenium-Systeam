'use strict';

const SearchResultsPage = require('../../src/pages/SearchResultsPage');

describe('SearchResultsPage', () => {
  let mockDriver;
  let mockItem;

  beforeEach(() => {
    mockItem = {
      getText: jest.fn().mockResolvedValue('Mock Title\n$1000\nTienda oficial'),
      findElement: jest.fn().mockImplementation((sel) => {
        return {
          getText: jest.fn().mockResolvedValue('Mock Text'),
          getAttribute: jest.fn().mockResolvedValue('https://example.com'),
        };
      }),
    };

    mockDriver = {
      wait: jest.fn().mockResolvedValue(),
      findElements: jest.fn().mockResolvedValue([mockItem, mockItem]),
    };
  });

  it('waitForResults resolves when found', async () => {
    const page = new SearchResultsPage(mockDriver, 1000);
    await expect(page.waitForResults()).resolves.toBeUndefined();
  });

  it('waitForResults throws on timeout', async () => {
    mockDriver.wait.mockRejectedValue(new Error('timeout'));
    const page = new SearchResultsPage(mockDriver, 1000);
    await expect(page.waitForResults()).rejects.toThrow('No se encontraron resultados');
  });

  it('getProducts returns parsed products', async () => {
    const page = new SearchResultsPage(mockDriver, 1000);
    // Mock logger para capturar warnings
    const logger = require('../../src/utils/logger');
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});

    const products = await page.getProducts(1);
    console.log('Warnings from getProducts:', warnSpy.mock.calls);
    expect(products.length).toBe(1);
    expect(products[0].titulo).toBe('Mock Text');
  });

  it('getProducts handles extraction errors gracefully', async () => {
    mockItem.findElement.mockRejectedValue(new Error('not found'));
    const page = new SearchResultsPage(mockDriver, 1000);
    const products = await page.getProducts(1);
    expect(products.length).toBe(0); // Because it skips the item
  });

  it('_findItems returns items if found', async () => {
    const page = new SearchResultsPage(mockDriver, 1000);
    const items = await page._findItems();
    expect(items.length).toBe(2);
  });

  it('_findItems returns empty array if not found', async () => {
    mockDriver.findElements.mockResolvedValue([]);
    const page = new SearchResultsPage(mockDriver, 1000);
    const items = await page._findItems();
    expect(items.length).toBe(0);
  });
});
