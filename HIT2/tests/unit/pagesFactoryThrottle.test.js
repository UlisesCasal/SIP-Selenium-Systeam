"use strict";

const fs = require("fs");

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("HomePage", () => {
  const HomePage = require("../../src/pages/HomePage");

  function inputElement() {
    return {
      clear: jest.fn().mockResolvedValue(undefined),
      sendKeys: jest.fn().mockResolvedValue(undefined),
    };
  }

  it("abre la home y espera el input de búsqueda", async () => {
    const input = inputElement();
    const driver = {
      get: jest.fn().mockResolvedValue(undefined),
      wait: jest.fn().mockResolvedValue(input),
    };

    await new HomePage(driver, 50).open();

    expect(driver.get).toHaveBeenCalledWith("https://www.mercadolibre.com.ar");
    expect(driver.wait).toHaveBeenCalled();
  });

  it("busca y clickea el primer botón disponible", async () => {
    const input = inputElement();
    const button = { click: jest.fn().mockResolvedValue(undefined) };
    const driver = {
      wait: jest.fn().mockResolvedValue(input),
      findElement: jest.fn().mockResolvedValue(button),
    };

    await new HomePage(driver, 50).search("bicicleta rodado 29");

    expect(input.clear).toHaveBeenCalled();
    expect(input.sendKeys).toHaveBeenCalledWith("bicicleta rodado 29");
    expect(button.click).toHaveBeenCalled();
  });

  it("falla si no aparece input ni elementos auxiliares", async () => {
    const driver = {
      wait: jest.fn().mockRejectedValue(new Error("missing")),
      findElement: jest.fn().mockRejectedValue(new Error("missing")),
    };
    const page = new HomePage(driver, 50);

    await expect(page._waitForSearchInput()).rejects.toThrow(/Search input/);
    await expect(page._findFirst([{ using: "css", value: ".x" }])).rejects.toThrow(/No element/);
  });
});

describe("SearchResultsPage", () => {
  const SearchResultsPage = require("../../src/pages/SearchResultsPage");

  function productElement({ title = "Bici", price = "100", href = "https://example.com" } = {}) {
    return {
      findElement: jest.fn((locator) => {
        const text = locator.toString();
        if (text.includes("poly-component__title")) {
          return {
            getText: jest.fn().mockResolvedValue(title),
            getAttribute: jest.fn().mockResolvedValue(href),
          };
        }
        if (text.includes("andes-money-amount__fraction")) {
          return {
            getText: jest.fn().mockResolvedValue(price),
            getAttribute: jest.fn().mockResolvedValue(null),
          };
        }
        if (text.includes("a")) {
          return {
            getAttribute: jest.fn().mockResolvedValue(href),
            getText: jest.fn().mockResolvedValue(""),
          };
        }
        throw new Error("missing");
      }),
    };
  }

  it("espera resultados y recuerda el locator que funcionó", async () => {
    const first = productElement();
    const driver = {
      wait: jest
        .fn()
        .mockRejectedValueOnce(new Error("missing"))
        .mockResolvedValue(true),
      findElement: jest.fn().mockResolvedValue(first),
    };
    const page = new SearchResultsPage(driver, 50);

    await page.waitForResults();

    expect(page._workingItemLocator).toBeTruthy();
  });

  it("extrae productos con precio, link y selector usado", async () => {
    const driver = {
      findElements: jest.fn().mockResolvedValue([
        productElement({ title: "Bici 1", price: "100" }),
        productElement({ title: "Bici 2", price: "200" }),
      ]),
    };

    const products = await new SearchResultsPage(driver, 50).getProducts(5);

    expect(products).toEqual([
      expect.objectContaining({ position: 1, title: "Bici 1", price: "$100", selectorUsed: ".poly-component__title" }),
      expect.objectContaining({ position: 2, title: "Bici 2", price: "$200", selectorUsed: ".poly-component__title" }),
    ]);
  });

  it("devuelve array vacío si no hay items y null si no hay link", async () => {
    const driver = {
      findElements: jest.fn().mockResolvedValue([]),
    };
    const page = new SearchResultsPage(driver, 50);
    await expect(page.getProducts(5)).resolves.toEqual([]);

    const noLink = {
      findElement: jest.fn(() => {
        throw new Error("missing");
      }),
    };
    await expect(page._extractLink(noLink)).resolves.toBeNull();
  });

  it("toma screenshot y guarda archivo", async () => {
    const driver = {
      takeScreenshot: jest.fn().mockResolvedValue("base64"),
    };
    const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false);
    const mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);

    const filePath = await new SearchResultsPage(driver, 50).takeScreenshot("test");

    expect(filePath).toContain("test-");
    expect(writeSpy).toHaveBeenCalledWith(filePath, "base64", "base64");

    existsSpy.mockRestore();
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
  });
});

describe("BrowserFactory", () => {
  const mockChromeOptions = {
    addArguments: jest.fn(),
  };
  const mockFirefoxOptions = {
    addArguments: jest.fn(),
  };
  const mockSetTimeouts = jest.fn().mockResolvedValue(undefined);
  const mockDriver = {
    manage: jest.fn(() => ({ setTimeouts: mockSetTimeouts })),
    getCapabilities: jest.fn().mockResolvedValue({
      get: jest.fn((key) => ({ browserVersion: "1", platformName: "test" }[key])),
    }),
  };
  const mockBuilder = {
    forBrowser: jest.fn().mockReturnThis(),
    setChromeOptions: jest.fn().mockReturnThis(),
    setFirefoxOptions: jest.fn().mockReturnThis(),
    build: jest.fn().mockResolvedValue(mockDriver),
  };

  beforeAll(() => {
    jest.doMock("selenium-webdriver", () => ({
      Builder: jest.fn(() => mockBuilder),
    }));
    jest.doMock("selenium-webdriver/chrome", () => ({
      Options: jest.fn(() => mockChromeOptions),
    }));
    jest.doMock("selenium-webdriver/firefox", () => ({
      Options: jest.fn(() => mockFirefoxOptions),
    }));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.dontMock("selenium-webdriver");
    jest.dontMock("selenium-webdriver/chrome");
    jest.dontMock("selenium-webdriver/firefox");
  });

  it("crea Chrome y Firefox con timeouts desde BrowserOptions", async () => {
    jest.resetModules();
    const BrowserFactory = require("../../src/utils/BrowserFactory");
    const BrowserOptions = require("../../src/utils/BrowserOptions");

    await BrowserFactory.create(new BrowserOptions({ browser: "chrome", headless: true }));
    expect(mockBuilder.forBrowser).toHaveBeenCalledWith("chrome");
    expect(mockBuilder.setChromeOptions).toHaveBeenCalledWith(mockChromeOptions);
    expect(mockChromeOptions.addArguments).toHaveBeenCalledWith("--headless=new");

    await BrowserFactory.create(new BrowserOptions({ browser: "firefox", headless: true }));
    expect(mockBuilder.forBrowser).toHaveBeenCalledWith("firefox");
    expect(mockBuilder.setFirefoxOptions).toHaveBeenCalledWith(mockFirefoxOptions);
    expect(mockFirefoxOptions.addArguments).toHaveBeenCalledWith("--headless");
    expect(mockSetTimeouts).toHaveBeenCalledWith({
      implicit: 0,
      pageLoad: 30000,
      script: 30000,
    });
  });

  it("fromCli crea el driver con opciones de CLI", async () => {
    jest.resetModules();
    const BrowserFactory = require("../../src/utils/BrowserFactory");
    await expect(BrowserFactory.fromCli()).resolves.toBe(mockDriver);
  });
});

describe("throttle", () => {
  const throttle = require("../../src/utils/throttle");

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resuelve después del tiempo indicado", async () => {
    const promise = throttle(25);
    jest.advanceTimersByTime(25);
    await expect(promise).resolves.toBeUndefined();
  });
});
