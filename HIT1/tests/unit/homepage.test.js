'use strict';

describe('HomePage', () => {
  let HomePage;
  let mockDriver;
  let mockElement;

  beforeEach(() => {
    mockElement = {
      clear: jest.fn().mockResolvedValue(undefined),
      sendKeys: jest.fn().mockResolvedValue(undefined),
      click: jest.fn().mockResolvedValue(undefined),
    };

    mockDriver = {
      get: jest.fn().mockResolvedValue(undefined),
      wait: jest.fn().mockResolvedValue(mockElement),
      findElement: jest.fn().mockResolvedValue(mockElement),
      getCurrentUrl: jest.fn().mockResolvedValue('https://listado.mercadolibre.com.ar/bicicleta-rodado-29'),
      getCapabilities: jest.fn().mockResolvedValue({
        getBrowserName: () => 'chrome',
      }),
      executeScript: jest.fn().mockResolvedValue(false),
      takeScreenshot: jest.fn().mockResolvedValue('base64screenshot'),
    };

    // Limpiar cache de módulos para cada test
    jest.resetModules();
    HomePage = require('../../src/pages/HomePage');
  });

  it('constructor inicializa los locators', () => {
    const page = new HomePage(mockDriver);
    expect(page.driver).toBe(mockDriver);
    expect(page.searchInputLocators).toBeDefined();
    expect(page.searchInputLocators.length).toBeGreaterThan(0);
    expect(page.searchButtonLocators).toBeDefined();
  });

  it('open() navega a la home y espera el input de búsqueda', async () => {
    const page = new HomePage(mockDriver);
    await page.open();
    expect(mockDriver.get).toHaveBeenCalledWith('https://www.mercadolibre.com.ar');
    expect(mockDriver.wait).toHaveBeenCalled();
  });

  it('search() en Chrome navega directamente a la URL del listado', async () => {
    const page = new HomePage(mockDriver);
    await page.search('bicicleta rodado 29');
    expect(mockDriver.get).toHaveBeenCalledWith(
      expect.stringContaining('listado.mercadolibre.com.ar')
    );
  });

  it('search() en Firefox usa el formulario de búsqueda', async () => {
    mockDriver.getCapabilities.mockResolvedValue({
      getBrowserName: () => 'firefox',
    });
    mockDriver.getCurrentUrl.mockResolvedValue(
      'https://listado.mercadolibre.com.ar/bicicleta-rodado-29'
    );

    const page = new HomePage(mockDriver);
    await page.search('bicicleta rodado 29');
    // Firefox usa _searchUsingHomeForm que llama a get(BASE_URL)
    expect(mockDriver.get).toHaveBeenCalledWith('https://www.mercadolibre.com.ar');
  });

  it('_findFirstLocated lanza error cuando ningún locator funciona', async () => {
    mockDriver.findElement.mockRejectedValue(new Error('not found'));
    const page = new HomePage(mockDriver);
    await expect(page._findFirstLocated(page.searchButtonLocators)).rejects.toThrow(
      'No se encontró ninguno de los locators provistos'
    );
  });

  it('_waitForSearchInput retorna el elemento cuando lo encuentra', async () => {
    const page = new HomePage(mockDriver);
    const result = await page._waitForSearchInput();
    expect(result).toBe(mockElement);
  });

  it('_waitForSearchInput lanza error cuando no encuentra el input', async () => {
    mockDriver.wait.mockRejectedValue(new Error('timeout'));
    mockDriver.takeScreenshot.mockResolvedValue('screenshotdata');
    const page = new HomePage(mockDriver);
    await expect(page._waitForSearchInput()).rejects.toThrow(
      'No se encontró el input de búsqueda en la home'
    );
  });

  it('search() con Chrome hace fallback al formulario si detecta account-verification', async () => {
    // Primera llamada a get (URL directa), segunda llamada a get (home fallback)
    let callCount = 0;
    mockDriver.get.mockImplementation(async () => {
      callCount++;
    });

    // Simular que la primera URL es de account-verification
    mockDriver.getCurrentUrl.mockResolvedValueOnce(
      'https://www.mercadolibre.com.ar/gz/account-verification'
    ).mockResolvedValue(
      'https://listado.mercadolibre.com.ar/bicicleta-rodado-29'
    );

    const page = new HomePage(mockDriver);
    await page.search('bicicleta rodado 29');
    // Debería haber llamado a get al menos 2 veces (URL directa + fallback home)
    expect(mockDriver.get.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('_sleep espera el tiempo indicado', async () => {
    const page = new HomePage(mockDriver);
    const start = Date.now();
    await page._sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });
});
