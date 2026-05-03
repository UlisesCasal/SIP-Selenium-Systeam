"use strict";

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

  jest.doMock("../../src/scrapers/MercadoLibreScraper", () => mockScraper);
  jest.doMock("../../src/config/ScraperConfig", () => ({
    fromEnv: mockFromEnv,
  }));
  jest.doMock("../../src/utils/logger", () => mockLogger);

  const cli = require("../../src/scrapers/mercadolibre");
  return { cli, mockScraper, mockRun, mockFromEnv };
}

describe("mercadolibre CLI", () => {
  const config = {
    browser: "chrome",
    headless: true,
    resultLimit: 2,
    products: ["bicicleta rodado 29"],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.dontMock("../../src/scrapers/MercadoLibreScraper");
    jest.dontMock("../../src/config/ScraperConfig");
    jest.dontMock("../../src/utils/logger");
  });

  it("scrape crea el scraper con la config recibida y ejecuta run", async () => {
    const { cli, mockScraper, mockRun } = loadCli({
      config,
      runImpl: () => Promise.resolve([{ query: "bicicleta" }]),
    });

    await expect(cli.scrape(config)).resolves.toEqual([{ query: "bicicleta" }]);
    expect(mockScraper).toHaveBeenCalledWith(config);
    expect(mockRun).toHaveBeenCalled();
  });

  it("scrape usa ScraperConfig.fromEnv cuando no recibe config", async () => {
    const { cli, mockFromEnv, mockScraper } = loadCli({ config });

    await cli.scrape();

    expect(mockFromEnv).toHaveBeenCalled();
    expect(mockScraper).toHaveBeenCalledWith(config);
  });

  it("main imprime resumen de archivos generados", async () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const { cli } = loadCli({
      config,
      runImpl: () => Promise.resolve([{
        query: "bicicleta rodado 29",
        filePath: "/tmp/bicicleta.json",
        products: [{ titulo: "Bicicleta" }, { titulo: "Otra" }],
      }]),
    });

    try {
      await cli.main();
      expect(mockLogger.info).toHaveBeenCalledWith("HIT #5 MercadoLibre multi-producto");
      expect(logSpy).toHaveBeenCalledWith("\nArchivos generados:");
      expect(logSpy).toHaveBeenCalledWith("- bicicleta rodado 29: /tmp/bicicleta.json (2 resultados)");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("main avisa si el resumen no es válido", async () => {
    const { cli } = loadCli({
      config,
      runImpl: () => Promise.resolve(null),
    });

    await cli.main();

    expect(mockLogger.warn).toHaveBeenCalledWith("El scraper terminó pero no se generó un resumen válido.");
  });

  it("main registra errores y sale con código 1", async () => {
    const exitSpy = jest.spyOn(process, "exit").mockImplementation((code) => {
      throw new Error(`process.exit:${code}`);
    });
    const { cli } = loadCli({
      config,
      runImpl: () => Promise.reject(new Error("falló scrape")),
    });

    try {
      await expect(cli.main()).rejects.toThrow("process.exit:1");
      expect(mockLogger.error).toHaveBeenCalledWith("Scraper falló: falló scrape");
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      exitSpy.mockRestore();
    }
  });
});
