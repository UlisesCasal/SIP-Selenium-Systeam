'use strict';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

function loadCli({ config, runImpl, fromEnvImpl } = {}) {
  jest.resetModules();

  const mockRun = jest.fn(runImpl || (() => Promise.resolve([])));
  const mockScraper = jest.fn().mockImplementation(() => ({
    run: mockRun,
  }));
  const mockFromEnv = jest.fn(fromEnvImpl || (() => config));

  jest.doMock('../../src/scrapers/MercadoLibreScraper', () => mockScraper);
  jest.doMock('../../src/config/ScraperConfig', () => ({
    fromEnv: mockFromEnv,
  }));
  jest.doMock('../../src/utils/logger', () => mockLogger);

  const cli = require('../../src/scrapers/mercadolibre');
  return { cli, mockScraper, mockRun, mockFromEnv };
}

describe('mercadolibre CLI', () => {
  const config = {
    browser: 'chrome',
    headless: true,
    resultLimit: 2,
    products: ['bicicleta rodado 29'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.dontMock('../../src/scrapers/MercadoLibreScraper');
    jest.dontMock('../../src/config/ScraperConfig');
    jest.dontMock('../../src/utils/logger');
  });

  it('scrape crea el scraper con la config recibida y ejecuta run', async () => {
    const { cli, mockScraper, mockRun } = loadCli({
      config,
      runImpl: () => Promise.resolve([{ query: 'bicicleta' }]),
    });

    await expect(cli.scrape(config)).resolves.toEqual([{ query: 'bicicleta' }]);
    expect(mockScraper).toHaveBeenCalledWith(config);
    expect(mockRun).toHaveBeenCalled();
  });

  it('scrape usa ScraperConfig.fromEnv cuando no recibe config', async () => {
    const { cli, mockFromEnv, mockScraper } = loadCli({ config });

    await cli.scrape();

    expect(mockFromEnv).toHaveBeenCalled();
    expect(mockScraper).toHaveBeenCalledWith(config);
  });

  it('main imprime resumen de archivos generados', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { cli } = loadCli({
      config,
      runImpl: () => Promise.resolve([{
        query: 'bicicleta rodado 29',
        filePath: '/tmp/bicicleta_rodado_29.json',
        products: [{ titulo: 'Bicicleta' }, { titulo: 'Otra bicicleta' }],
      }]),
    });

    await cli.main();

    expect(mockLogger.info).toHaveBeenCalledWith('HIT #4 MercadoLibre multi-producto');
    expect(logSpy).toHaveBeenCalledWith('\nArchivos generados:');
    expect(logSpy).toHaveBeenCalledWith('- bicicleta rodado 29: /tmp/bicicleta_rodado_29.json (2 resultados)');

    logSpy.mockRestore();
  });

  it('main registra errores y sale con código 1', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    const { cli } = loadCli({
      config,
      runImpl: () => Promise.reject(new Error('falló scrape')),
    });

    await cli.main();

    expect(mockLogger.error).toHaveBeenCalledWith('Scraper falló: falló scrape');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});