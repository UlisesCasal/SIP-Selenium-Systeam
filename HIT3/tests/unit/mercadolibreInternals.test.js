"use strict";

const fs = require("fs");

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("mercadolibre internals", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.dontMock("../../src/utils/BrowserFactory");
    jest.dontMock("../../src/utils/throttle");
    jest.dontMock("../../src/pages/HomePage");
    jest.dontMock("../../src/pages/SearchResultsPage");
    jest.dontMock("../../src/pages/FiltersPage");
  });

  it("saveResults persiste JSON en results", () => {
    const { saveResults } = require("../../src/scrapers/mercadolibre");
    const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false);
    const mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);
    const payload = [{ query: "bicicleta rodado 29", products: [] }];

    const filePath = saveResults(payload, "chrome");

    expect(filePath).toContain("results-chrome-");
    expect(mkdirSpy).toHaveBeenCalledWith(expect.stringContaining("results"), { recursive: true });
    expect(writeSpy).toHaveBeenCalledWith(filePath, JSON.stringify(payload, null, 2), "utf-8");

    existsSpy.mockRestore();
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it("runQueryWithRetries usa fallback tras agotar intentos", async () => {
    jest.resetModules();
    const quit = jest.fn().mockResolvedValue(undefined);
    jest.doMock("../../src/utils/BrowserFactory", () => ({
      create: jest.fn().mockResolvedValue({ quit }),
    }));
    jest.doMock("../../src/utils/throttle", () => jest.fn().mockResolvedValue(undefined));
    jest.doMock("../../src/pages/HomePage", () =>
      jest.fn().mockImplementation(() => ({
        open: jest.fn().mockRejectedValue(new Error("bloqueo")),
        search: jest.fn(),
      })),
    );
    jest.doMock("../../src/pages/SearchResultsPage", () =>
      jest.fn().mockImplementation(() => ({
        waitForResults: jest.fn(),
        getProducts: jest.fn(),
        takeScreenshot: jest.fn(),
      })),
    );
    jest.doMock("../../src/pages/FiltersPage", () =>
      jest.fn().mockImplementation(() => ({
        applyAllFilters: jest.fn(),
      })),
    );
    const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false);
    const mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);

    const BrowserOptions = require("../../src/utils/BrowserOptions");
    const { runQueryWithRetries, FALLBACK_FILTERS } = require("../../src/scrapers/mercadolibre");
    const result = await runQueryWithRetries(
      "bicicleta rodado 29",
      new BrowserOptions({ browser: "chrome", headless: true }),
    );

    expect(result.products).toHaveLength(5);
    expect(result.filtersApplied).toEqual(FALLBACK_FILTERS);
    expect(result.screenshotPath).toMatch(/bicicleta_rodado_29_chrome\.png$/);
    expect(quit).toHaveBeenCalledTimes(3);
    expect(writeSpy).toHaveBeenCalled();

    existsSpy.mockRestore();
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
  });
});
