'use strict';

const HomePage = require('../../src/pages/HomePage');
const { By, Key } = require('selenium-webdriver');

describe('HomePage', () => {
  let mockDriver;
  let mockElement;

  beforeEach(() => {
    mockElement = {
      clear: jest.fn().mockResolvedValue(),
      sendKeys: jest.fn().mockResolvedValue(),
    };
    mockDriver = {
      get: jest.fn().mockResolvedValue(),
      findElements: jest.fn().mockResolvedValue([]),
      wait: jest.fn().mockResolvedValue(mockElement),
    };
  });

  it('open navigates and waits for input', async () => {
    const page = new HomePage(mockDriver, 1000);
    await page.open();
    expect(mockDriver.get).toHaveBeenCalledWith('https://www.mercadolibre.com.ar');
    expect(mockDriver.wait).toHaveBeenCalledTimes(2); // once for locate, once for visible
  });

  it('search clears and sends keys', async () => {
    const page = new HomePage(mockDriver, 1000);
    await page.search('bicicleta');
    expect(mockElement.clear).toHaveBeenCalled();
    expect(mockElement.sendKeys).toHaveBeenCalledWith('bicicleta', Key.ENTER);
  });

  it('throws error if bot detected', async () => {
    mockDriver.findElements.mockResolvedValue(['mock element']);
    const page = new HomePage(mockDriver, 1000);
    await expect(page.open()).rejects.toThrow('BOT DETECTADO');
  });

  it('throws error if input not found', async () => {
    mockDriver.wait.mockRejectedValue(new Error('timeout'));
    const page = new HomePage(mockDriver, 1000);
    await expect(page.open()).rejects.toThrow('No se encontró el input de búsqueda');
  });
});
