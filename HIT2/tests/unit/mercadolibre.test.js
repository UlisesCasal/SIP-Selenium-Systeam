"use strict";

const fs = require("fs");
const { saveResults } = require("../../src/scrapers/mercadolibre");

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("mercadolibre helpers", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("guarda los resultados como JSON y crea el directorio si falta", () => {
    const existsSpy = jest.spyOn(fs, "existsSync").mockReturnValue(false);
    const mkdirSpy = jest.spyOn(fs, "mkdirSync").mockImplementation(() => undefined);
    const writeSpy = jest.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);
    const payload = [{
      query: "bicicleta rodado 29",
      browser: "chrome",
      products: [{ position: 1, title: "Bici", price: "$1", url: null, selectorUsed: "h2" }],
    }];

    const filePath = saveResults(payload, "chrome");

    expect(filePath).toContain("results-chrome-");
    expect(existsSpy).toHaveBeenCalled();
    expect(mkdirSpy).toHaveBeenCalledWith(expect.stringContaining("results"), { recursive: true });
    expect(writeSpy).toHaveBeenCalledWith(
      filePath,
      JSON.stringify(payload, null, 2),
      "utf-8",
    );
  });
});
