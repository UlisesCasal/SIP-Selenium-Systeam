"use strict";

const { parseProducts, slugifyProduct } = require("../../src/config/products");
const ScraperConfig = require("../../src/config/ScraperConfig");

describe("configuración", () => {
  it("parsea PRODUCTS separado por pipe", () => {
    expect(parseProducts("a| b |")).toEqual(["a", "b"]);
  });

  it("genera los nombres de archivo requeridos", () => {
    expect(slugifyProduct("bicicleta rodado 29")).toBe("bicicleta_rodado_29");
    expect(slugifyProduct("iPhone 16 Pro Max")).toBe("iphone_16_pro_max");
    expect(slugifyProduct("GeForce RTX 5090")).toBe("geforce_5090");
  });

  it("valida browser soportado", () => {
    expect(() => new ScraperConfig({ browser: "safari" })).toThrow(
      /Browser no soportado/,
    );
  });
});
