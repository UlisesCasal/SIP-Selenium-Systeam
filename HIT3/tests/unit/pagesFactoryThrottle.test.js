"use strict";

const fs = require("fs");

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

function inputElement() {
  return {
    clear: jest.fn().mockResolvedValue(undefined),
    sendKeys: jest.fn().mockResolvedValue(undefined),
  };
}

describe("HomePage", () => {
  const HomePage = require("../../src/pages/HomePage");

  it("abre la home y espera el input", async () => {
    const input = inputElement();
    const driver = {
      get: jest.fn().mockResolvedValue(undefined),
      findElement: jest.fn(() => ({ getText: jest.fn().mockResolvedValue("") })),
      wait: jest.fn().mockResolvedValue(input),
    };

    await new HomePage(driver, 50).open();

    expect(driver.get).toHaveBeenCalledWith("https://www.mercadolibre.com.ar");
    expect(driver.wait).toHaveBeenCalled();
  });

  it("busca con Enter y usa botón como fallback si falla", async () => {
    const input = inputElement();
    input.sendKeys
      .mockRejectedValueOnce(new Error("enter failed"))
      .mockResolvedValueOnce(undefined);
    const button = { click: jest.fn().mockResolvedValue(undefined) };
    const driver = {
      findElement: jest
        .fn()
        .mockReturnValueOnce({ getText: jest.fn().mockResolvedValue("") })
        .mockReturnValue(button),
      wait: jest.fn().mockResolvedValue(input),
    };

    await new HomePage(driver, 50).search("bicicleta rodado 29");

    expect(input.clear).toHaveBeenCalled();
    expect(input.sendKeys).toHaveBeenCalledWith("bicicleta rodado 29", expect.any(String));
    expect(input.sendKeys).toHaveBeenCalledWith("bicicleta rodado 29");
    expect(button.click).toHaveBeenCalled();
  });

  it("detecta bloqueo y falla si no encuentra locators auxiliares", async () => {
    const blocked = new HomePage({
      findElement: jest.fn(() => ({ getText: jest.fn().mockResolvedValue("robot") })),
    }, 50);
    await expect(blocked._waitForSearchInput()).rejects.toThrow(/BOT DETECTADO/);

    const page = new HomePage({
      findElement: jest.fn().mockRejectedValue(new Error("missing")),
    }, 50);
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
      findElements: jest.fn().mockResolvedValue([first]),
      findElement: jest.fn().mockResolvedValue(first),
      wait: jest.fn(async (condition) => {
        if (typeof condition === "function") return condition();
        return true;
      }),
    };
    const page = new SearchResultsPage(driver, 50);

    await page.waitForResults();

    expect(page._workingItemLocator).toBeTruthy();
  });

  it("extrae productos con precio, link y selector", async () => {
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

  it("devuelve vacío si no hay items y null si no hay link", async () => {
    const page = new SearchResultsPage({ findElements: jest.fn().mockResolvedValue([]) }, 50);
    await expect(page.getProducts(5)).resolves.toEqual([]);

    await expect(page._extractLink({
      findElement: jest.fn(() => {
        throw new Error("missing");
      }),
    })).resolves.toBeNull();
  });

  it("toma screenshot", async () => {
    const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false);
    const mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);
    const driver = { takeScreenshot: jest.fn().mockResolvedValue("base64") };

    const filePath = await new SearchResultsPage(driver, 50).takeScreenshot("test");

    expect(filePath).toContain("test-");
    expect(writeSpy).toHaveBeenCalledWith(filePath, "base64", "base64");
    existsSpy.mockRestore();
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
  });
});

describe("FiltersPage", () => {
  const FiltersPage = require("../../src/pages/FiltersPage");

  it("aplica filtros y reporta las tres claves", async () => {
    const page = new FiltersPage({}, 50);
    page.applyConditionNuevo = jest.fn().mockResolvedValue(true);
    page.applyOfficialStoreSi = jest.fn().mockResolvedValue(true);
    page.applySortMasRelevantes = jest.fn().mockResolvedValue(false);

    await expect(page.applyAllFilters()).resolves.toEqual({
      condicion: true,
      tiendaOficial: true,
      orden: false,
    });
  });

  it("aplica condición y tienda oficial cuando encuentra links", async () => {
    const link = { click: jest.fn().mockResolvedValue(undefined) };
    const page = new FiltersPage({}, 50);
    page._findConditionNuevo = jest.fn().mockResolvedValue(link);
    page._findOfficialStore = jest.fn().mockResolvedValue(link);
    page._scrollIntoView = jest.fn().mockResolvedValue(undefined);
    page._clickAndWait = jest.fn().mockResolvedValue(true);

    await expect(page.applyConditionNuevo()).resolves.toBe(true);
    await expect(page.applyOfficialStoreSi()).resolves.toBe(true);
    expect(page._clickAndWait).toHaveBeenCalledWith(link, "Condición:Nuevo");
    expect(page._clickAndWait).toHaveBeenCalledWith(link, "TiendaOficial");
  });

  it("devuelve false si condición, tienda o resultados no aparecen", async () => {
    const page = new FiltersPage({}, 50);
    page._findConditionNuevo = jest.fn().mockResolvedValue(null);
    page._findOfficialStore = jest.fn().mockResolvedValue(null);

    await expect(page.applyConditionNuevo()).resolves.toBe(false);
    await expect(page.applyOfficialStoreSi()).resolves.toBe(false);

    const noResults = new FiltersPage({
      wait: jest.fn().mockRejectedValue(new Error("missing")),
    }, 1);
    await expect(noResults._waitForResults()).rejects.toThrow(/Resultados/);
  });

  it("encuentra filtros por CSS, detecta login y espera resultados", async () => {
    const link = { getText: jest.fn().mockResolvedValue("Nuevo"), click: jest.fn().mockResolvedValue(undefined) };
    const driver = {
      findElements: jest.fn().mockResolvedValue([link]),
      getCurrentUrl: jest.fn().mockResolvedValue("https://www.mercadolibre.com.ar/login"),
      wait: jest.fn().mockResolvedValue(true),
      executeScript: jest.fn().mockResolvedValue(undefined),
      findElement: jest.fn().mockResolvedValue(link),
    };
    const page = new FiltersPage(driver, 50);

    await expect(page._cssFirst('aside a[href*="/nuevo/"]', "Nuevo")).resolves.toBe(link);
    await expect(page._isLoginWall()).resolves.toBe(true);
    await expect(page._waitForResults()).resolves.toBeUndefined();
  });

  it("sort devuelve true si ya está en Más relevantes", async () => {
    const trigger = { getText: jest.fn().mockResolvedValue("Más relevantes") };
    const page = new FiltersPage({
      findElement: jest.fn().mockResolvedValue(trigger),
    }, 50);

    await expect(page._sortViaDropdown()).resolves.toBe(true);
  });

  it("sort via select elige una opción relevante", async () => {
    const option = {
      getText: jest.fn().mockResolvedValue("Más relevantes"),
      click: jest.fn().mockResolvedValue(undefined),
    };
    const select = {
      getAttribute: jest.fn().mockResolvedValue("other"),
      findElements: jest.fn().mockResolvedValue([option]),
    };
    const page = new FiltersPage({
      findElement: jest.fn().mockResolvedValue(select),
      executeScript: jest.fn().mockResolvedValue(undefined),
      wait: jest.fn().mockResolvedValue(true),
    }, 50);

    await expect(page._sortViaSelect()).resolves.toBe(true);
    expect(option.click).toHaveBeenCalled();
  });

  it("clickAndWait vuelve atrás si aparece muro de login", async () => {
    const element = { click: jest.fn().mockResolvedValue(undefined) };
    const back = jest.fn().mockResolvedValue(undefined);
    const driver = {
      getCurrentUrl: jest
        .fn()
        .mockResolvedValueOnce("https://listado.mercadolibre.com.ar/a")
        .mockResolvedValueOnce("https://www.mercadolibre.com.ar/login")
        .mockResolvedValue("https://www.mercadolibre.com.ar/login"),
      wait: jest.fn(async (condition) => {
        if (typeof condition === "function") return condition();
        return true;
      }),
      navigate: jest.fn(() => ({ back })),
      findElement: jest.fn().mockResolvedValue({}),
    };

    await expect(new FiltersPage(driver, 50)._clickAndWait(element, "Filtro")).resolves.toBe(false);
    expect(back).toHaveBeenCalled();
  });
});

describe("BrowserFactory", () => {
  const mockChromeOptions = {
    addArguments: jest.fn(),
    excludeSwitches: jest.fn(),
    setPageLoadStrategy: jest.fn(),
  };
  const mockFirefoxOptions = {
    addArguments: jest.fn(),
    setPreference: jest.fn(),
    setPageLoadStrategy: jest.fn(),
  };
  const mockSetTimeouts = jest.fn().mockResolvedValue(undefined);
  const mockDriver = {
    executeScript: jest.fn().mockResolvedValue(undefined),
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

  afterAll(() => {
    jest.dontMock("selenium-webdriver");
    jest.dontMock("selenium-webdriver/chrome");
    jest.dontMock("selenium-webdriver/firefox");
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("crea Chrome y Firefox con timeouts", async () => {
    jest.resetModules();
    const BrowserFactory = require("../../src/utils/BrowserFactory");
    const BrowserOptions = require("../../src/utils/BrowserOptions");

    await BrowserFactory.create(new BrowserOptions({ browser: "chrome", headless: true }));
    expect(mockBuilder.forBrowser).toHaveBeenCalledWith("chrome");
    expect(mockChromeOptions.addArguments).toHaveBeenCalledWith("--headless=new");
    expect(mockChromeOptions.excludeSwitches).toHaveBeenCalledWith("enable-automation");

    await BrowserFactory.create(new BrowserOptions({ browser: "firefox", headless: true }));
    expect(mockBuilder.forBrowser).toHaveBeenCalledWith("firefox");
    expect(mockFirefoxOptions.addArguments).toHaveBeenCalledWith("--headless");
    expect(mockSetTimeouts).toHaveBeenCalledWith({
      implicit: 0,
      pageLoad: 120000,
      script: 60000,
    });
  });

  it("fromCli crea driver desde opciones CLI", async () => {
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
