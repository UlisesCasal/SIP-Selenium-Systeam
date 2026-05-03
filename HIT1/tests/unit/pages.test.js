"use strict";

const fs = require("fs");
const HomePage = require("../../src/pages/HomePage");
const SearchResultsPage = require("../../src/pages/SearchResultsPage");

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
  it("abre la home y espera el input", async () => {
    const input = inputElement();
    const driver = {
      get: jest.fn().mockResolvedValue(undefined),
      wait: jest.fn().mockResolvedValue(input),
    };

    await new HomePage(driver).open();

    expect(driver.get).toHaveBeenCalledWith("https://www.mercadolibre.com.ar");
    expect(driver.wait).toHaveBeenCalled();
  });

  it("usa navegación directa en Chrome y fallback a formulario si hay verificación", async () => {
    const input = inputElement();
    const button = { click: jest.fn().mockResolvedValue(undefined) };
    const driver = {
      getCapabilities: jest.fn().mockResolvedValue({ getBrowserName: () => "chrome" }),
      get: jest.fn().mockResolvedValue(undefined),
      getCurrentUrl: jest
        .fn()
        .mockResolvedValueOnce("https://www.mercadolibre.com.ar/gz/account-verification")
        .mockResolvedValue("https://listado.mercadolibre.com.ar/bicicleta-rodado-29"),
      executeScript: jest.fn().mockResolvedValue(false),
      wait: jest.fn(async (condition) => {
        if (typeof condition === "function") return condition();
        return input;
      }),
      findElement: jest.fn().mockResolvedValue(button),
    };
    const page = new HomePage(driver);
    page._sleep = jest.fn().mockResolvedValue(undefined);

    await page.search("Bicicleta rodado 29");

    expect(driver.get).toHaveBeenCalledWith("https://listado.mercadolibre.com.ar/bicicleta-rodado-29");
    expect(input.clear).toHaveBeenCalled();
    expect(button.click).toHaveBeenCalled();
  });

  it("en Firefox busca desde el formulario y usa Enter si no encuentra botón", async () => {
    const input = inputElement();
    const driver = {
      getCapabilities: jest.fn().mockResolvedValue({ getBrowserName: () => "firefox" }),
      get: jest.fn().mockResolvedValue(undefined),
      getCurrentUrl: jest.fn().mockResolvedValue("https://listado.mercadolibre.com.ar/iphone-16-pro-max"),
      executeScript: jest.fn().mockResolvedValue(false),
      wait: jest.fn(async (condition) => {
        if (typeof condition === "function") return condition();
        return input;
      }),
      findElement: jest.fn().mockRejectedValue(new Error("missing")),
    };

    await new HomePage(driver).search("iPhone 16 Pro Max");

    expect(input.sendKeys).toHaveBeenCalledWith("iPhone 16 Pro Max");
    expect(input.sendKeys).toHaveBeenCalledWith(expect.any(String));
  });

  it("guarda screenshot de debug si no aparece el input", async () => {
    const driver = {
      wait: jest.fn().mockRejectedValue(new Error("timeout")),
      takeScreenshot: jest.fn().mockResolvedValue("base64"),
    };
    const mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    await expect(new HomePage(driver)._waitForSearchInput()).rejects.toThrow(/input de búsqueda/);

    expect(writeSpy).toHaveBeenCalled();
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
    fs.existsSync.mockRestore();
  });
});

describe("SearchResultsPage", () => {
  it("espera resultados visibles", async () => {
    const driver = {
      executeScript: jest.fn().mockResolvedValue(true),
      wait: jest.fn(async (condition) => condition()),
    };

    await expect(new SearchResultsPage(driver).waitForResults()).resolves.toBeUndefined();
  });

  it("extrae productos usando executeScript", async () => {
    const driver = {
      executeScript: jest.fn().mockResolvedValue([
        { position: 1, title: "Bici", price: "$100", url: "https://example.com" },
      ]),
    };

    const products = await new SearchResultsPage(driver).getProducts(5);

    expect(products).toHaveLength(1);
    expect(products[0].title).toBe("Bici");
  });

  it("toma screenshot y devuelve la ruta", async () => {
    const driver = {
      takeScreenshot: jest.fn().mockResolvedValue("base64"),
    };
    const mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    const filePath = await new SearchResultsPage(driver).takeScreenshot("test");

    expect(filePath).toContain("test-");
    expect(writeSpy).toHaveBeenCalledWith(filePath, "base64", "base64");
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
    fs.existsSync.mockRestore();
  });

  it("toma datos de debug y falla si no encuentra resultados", async () => {
    const driver = {
      wait: jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(false),
      executeScript: jest.fn().mockResolvedValue("li: 0"),
      getCurrentUrl: jest.fn().mockResolvedValue("https://example.com"),
      getTitle: jest.fn().mockResolvedValue("Sin resultados"),
      takeScreenshot: jest.fn().mockResolvedValue("base64"),
    };
    const mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);
    jest.spyOn(fs, "existsSync").mockReturnValue(false);

    await expect(new SearchResultsPage(driver).waitForResults()).rejects.toThrow(/ningún resultado/);

    expect(writeSpy).toHaveBeenCalled();
    mkdirSpy.mockRestore();
    writeSpy.mockRestore();
    fs.existsSync.mockRestore();
  });
});
