'use strict';

const HomePage = require('../../src/pages/HomePage');
const FiltersPage = require('../../src/pages/FiltersPage');
const SearchResultsPage = require('../../src/pages/SearchResultsPage');

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

function locatorText(locator) {
  return locator.toString();
}

function elementWithText(text, attrs = {}) {
  return {
    getText: jest.fn().mockResolvedValue(text),
    getAttribute: jest.fn((name) => Promise.resolve(attrs[name] || null)),
    clear: jest.fn().mockResolvedValue(undefined),
    sendKeys: jest.fn().mockResolvedValue(undefined),
    click: jest.fn().mockResolvedValue(undefined),
    findElement: jest.fn(),
  };
}

describe('HomePage', () => {
  it('abre MercadoLibre y espera el input de búsqueda', async () => {
    const input = elementWithText('');
    const driver = {
      get: jest.fn().mockResolvedValue(undefined),
      findElements: jest.fn().mockResolvedValue([]),
      wait: jest.fn().mockResolvedValue(input),
    };

    await new HomePage(driver, 50).open();

    expect(driver.get).toHaveBeenCalledWith('https://www.mercadolibre.com.ar');
    expect(driver.wait).toHaveBeenCalled();
  });

  it('busca limpiando el input y enviando enter', async () => {
    const input = elementWithText('');
    const driver = {
      findElements: jest.fn().mockResolvedValue([]),
      wait: jest.fn().mockResolvedValue(input),
    };

    await new HomePage(driver, 50).search('bicicleta rodado 29');

    expect(input.clear).toHaveBeenCalled();
    expect(input.sendKeys).toHaveBeenCalledWith('bicicleta rodado 29', expect.any(String));
  });

  it('falla si MercadoLibre muestra muro de login', async () => {
    const driver = {
      findElements: jest.fn().mockResolvedValue([elementWithText('ingresa a tu cuenta')]),
      wait: jest.fn(),
    };

    await expect(new HomePage(driver, 50)._waitForSearchInput()).rejects.toThrow(/BOT DETECTADO/);
  });

  it('devuelve null si no encuentra ningún locator auxiliar', async () => {
    const driver = {
      findElement: jest.fn().mockRejectedValue(new Error('missing')),
    };

    await expect(new HomePage(driver)._findFirst([{ using: 'css', value: '.x' }])).resolves.toBeNull();
  });
});

describe('SearchResultsPage', () => {
  it('espera resultados y recuerda el locator encontrado', async () => {
    const driver = {
      wait: jest
        .fn()
        .mockRejectedValueOnce(new Error('missing'))
        .mockResolvedValueOnce(true),
    };
    const page = new SearchResultsPage(driver, 50);

    await page.waitForResults();

    expect(page.itemLocator).toBeTruthy();
    expect(driver.wait).toHaveBeenCalledTimes(2);
  });

  it('normaliza productos válidos y omite tarjetas incompletas', async () => {
    const valid = elementWithText('Apple Envío gratis 12 cuotas sin interés');
    valid.findElement.mockImplementation((locator) => {
      const text = locatorText(locator);
      if (text.includes('poly-component__title')) {
        return elementWithText('iPhone 16 Pro Max', { href: 'https://example.com/iphone' });
      }
      if (text.includes('andes-money-amount__fraction')) {
        return elementWithText('$ 4.999.999');
      }
      if (text.includes('poly-component__seller')) {
        return elementWithText('Tienda oficial Apple');
      }
      throw new Error('missing');
    });

    const invalid = elementWithText('sin datos');
    invalid.findElement.mockImplementation(() => {
      throw new Error('missing');
    });

    const driver = {
      findElements: jest.fn().mockResolvedValue([valid, invalid]),
    };
    const products = await new SearchResultsPage(driver, 50).getProducts(10);

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      titulo: 'iPhone 16 Pro Max',
      precio: 4999999,
      link: 'https://example.com/iphone',
      tienda_oficial: 'Apple',
      envio_gratis: true,
    });
  });

  it('usa aria-label como fallback de texto y exige links absolutos', async () => {
    const element = elementWithText('');
    element.findElement.mockReturnValue(elementWithText('', { 'aria-label': '123 pesos', href: '/relativo' }));
    const page = new SearchResultsPage({ findElements: jest.fn() }, 50);

    await expect(page._textFromSelectors(element, ['.price'], false)).resolves.toBe('123 pesos');
    await expect(page._extractLink(element)).rejects.toThrow(/Link absoluto/);
  });
});

describe('FiltersPage', () => {
  it('aplica filtros principales con sus helpers', async () => {
    const page = new FiltersPage({}, 50);
    page.applyConditionNuevo = jest.fn().mockResolvedValue(true);
    page.applyOfficialStore = jest.fn().mockResolvedValue(false);
    page.applySortMasRelevantes = jest.fn().mockResolvedValue(true);

    await expect(page.applyAllFilters()).resolves.toEqual({
      condicion: true,
      tiendaOficial: false,
      orden: true,
    });
  });

  it('convierte excepciones de filtros en false', async () => {
    const page = new FiltersPage({}, 50);

    await expect(page._safeApply('filtro', async () => {
      throw new Error('boom');
    })).resolves.toBe(false);
  });

  it('clickea un filtro, espera cambio de URL y resultados', async () => {
    const element = elementWithText('Nuevo');
    const driver = {
      getCurrentUrl: jest
        .fn()
        .mockResolvedValueOnce('https://listado.mercadolibre.com.ar/a')
        .mockResolvedValueOnce('https://listado.mercadolibre.com.ar/b')
        .mockResolvedValueOnce('https://listado.mercadolibre.com.ar/b'),
      executeScript: jest.fn().mockResolvedValue(undefined),
      wait: jest.fn(async (condition) => {
        if (typeof condition === 'function') return condition();
        return true;
      }),
      findElements: jest.fn().mockResolvedValue([]),
    };

    await expect(new FiltersPage(driver, 50)._clickAndWait(element)).resolves.toBe(true);

    expect(driver.executeScript).toHaveBeenCalled();
    expect(element.click).toHaveBeenCalled();
  });

  it('detecta muro de login por URL o textos de la página', async () => {
    const byUrl = new FiltersPage({
      getCurrentUrl: jest.fn().mockResolvedValue('https://www.mercadolibre.com.ar/login'),
      findElements: jest.fn(),
    }, 50);
    const byMarker = new FiltersPage({
      getCurrentUrl: jest.fn().mockResolvedValue('https://www.mercadolibre.com.ar/checkout'),
      findElements: jest.fn().mockResolvedValue([elementWithText('Para continuar')]),
    }, 50);

    await expect(byUrl._isLoginWall()).resolves.toBe(true);
    await expect(byMarker._isLoginWall()).resolves.toBe(true);
  });
});