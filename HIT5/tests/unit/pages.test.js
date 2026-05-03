"use strict";

const HomePage = require("../../src/pages/HomePage");
const SearchResultsPage = require("../../src/pages/SearchResultsPage");
const FiltersPage = require("../../src/pages/FiltersPage");

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

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

describe("HomePage", () => {
  it("abre MercadoLibre y espera el input", async () => {
    const input = elementWithText("");
    const driver = {
      get: jest.fn().mockResolvedValue(undefined),
      findElements: jest.fn().mockResolvedValue([]),
      wait: jest.fn().mockResolvedValue(input),
    };

    await new HomePage(driver, 50).open();

    expect(driver.get).toHaveBeenCalledWith("https://www.mercadolibre.com.ar");
    expect(driver.wait).toHaveBeenCalled();
  });

  it("busca limpiando el input y enviando enter", async () => {
    const input = elementWithText("");
    const driver = {
      findElements: jest.fn().mockResolvedValue([]),
      wait: jest.fn().mockResolvedValue(input),
    };

    await new HomePage(driver, 50).search("bicicleta rodado 29");

    expect(input.clear).toHaveBeenCalled();
    expect(input.sendKeys).toHaveBeenCalledWith("bicicleta rodado 29", expect.any(String));
  });

  it("falla si MercadoLibre muestra bloqueo de login", async () => {
    const driver = {
      findElements: jest.fn().mockResolvedValue([elementWithText("ingresa a tu cuenta")]),
      wait: jest.fn(),
    };

    await expect(new HomePage(driver, 50)._waitForSearchInput()).rejects.toThrow(/BOT DETECTADO/);
  });

  it("falla con mensaje claro si no aparece el input", async () => {
    const driver = {
      findElements: jest.fn().mockResolvedValue([]),
      wait: jest.fn().mockRejectedValue(new Error("timeout")),
    };

    await expect(new HomePage(driver, 50)._waitForSearchInput()).rejects.toThrow(/No se encontró/);
  });
});

describe("SearchResultsPage", () => {
  it("espera resultados usando selector combinado", async () => {
    const driver = {
      wait: jest.fn().mockResolvedValue(true),
    };

    await expect(new SearchResultsPage(driver, 50).waitForResults()).resolves.toBeUndefined();
  });

  it("normaliza productos válidos y omite tarjetas incompletas", async () => {
    const valid = elementWithText("Tienda oficial Apple Envío gratis 12 cuotas sin interés");
    valid.findElement.mockImplementation((locator) => {
      const text = locator.toString();
      if (text.includes("poly-component__title")) {
        return elementWithText("iPhone 16 Pro Max", { href: "https://example.com/iphone" });
      }
      if (text.includes("andes-money-amount__fraction")) {
        return elementWithText("$ 4.999.999");
      }
      if (text.includes("seller")) {
        return elementWithText("Tienda oficial Apple");
      }
      if (text.includes("cuotas")) {
        return elementWithText("12 cuotas sin interés");
      }
      if (text.includes("envío gratis") || text.includes("ui-pb-highlight")) {
        return elementWithText("Envío gratis");
      }
      throw new Error("missing");
    });

    const invalid = elementWithText("sin datos");
    invalid.findElement.mockImplementation(() => {
      throw new Error("missing");
    });

    const driver = {
      findElements: jest.fn().mockResolvedValue([valid, invalid]),
    };
    const products = await new SearchResultsPage(driver, 50).getProducts(10, "iphone", "chrome");

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      titulo: "iPhone 16 Pro Max",
      precio: 4999999,
      link: "https://example.com/iphone",
      envio_gratis: true,
    });
  });

  it("usa aria-label como fallback y exige link absoluto", async () => {
    const element = elementWithText("");
    element.findElement.mockReturnValue(elementWithText("", { "aria-label": "123 pesos", href: "/relativo" }));
    const page = new SearchResultsPage({ findElements: jest.fn() }, 50);

    await expect(page._textFromSelectors(element, [{ toString: () => "price" }], false)).resolves.toBe("123 pesos");
    await expect(page._extractLink(element, "test", "chrome")).rejects.toThrow(/Link absoluto/);
  });

  it("devuelve vacío si no encuentra items", async () => {
    const page = new SearchResultsPage({
      findElements: jest.fn().mockResolvedValue([]),
    }, 50);

    await expect(page.getProducts(5)).resolves.toEqual([]);
  });
});

describe("FiltersPage", () => {
  it("aplica filtros principales con sus helpers", async () => {
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

  it("convierte excepciones en false", async () => {
    const page = new FiltersPage({}, 50);
    await expect(page._safeApply("filtro", async () => {
      throw new Error("boom");
    })).resolves.toBe(false);
  });

  it("detecta orden actual y muros de login", async () => {
    const page = new FiltersPage({
      findElements: jest.fn().mockResolvedValue([elementWithText("Más relevantes")]),
      getCurrentUrl: jest.fn().mockResolvedValue("https://www.mercadolibre.com.ar/login"),
    }, 50);

    await expect(page.applySortMasRelevantes()).resolves.toBe(true);
    await expect(page._isLoginWall()).resolves.toBe(true);
  });

  it("clickea un filtro y espera resultados", async () => {
    const element = elementWithText("Nuevo");
    const driver = {
      getCurrentUrl: jest
        .fn()
        .mockResolvedValueOnce("https://listado.mercadolibre.com.ar/a")
        .mockResolvedValueOnce("https://listado.mercadolibre.com.ar/b")
        .mockResolvedValue("https://listado.mercadolibre.com.ar/b"),
      executeScript: jest.fn().mockResolvedValue(undefined),
      wait: jest.fn(async (condition) => {
        if (typeof condition === "function") return condition();
        return true;
      }),
      findElements: jest.fn().mockResolvedValue([]),
    };

    await expect(new FiltersPage(driver, 50)._clickAndWait(element)).resolves.toBe(true);
    expect(element.click).toHaveBeenCalled();
  });
});
