"use strict";

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
}));

const mockChromeOptions = {
  setPageLoadStrategy: jest.fn(),
  excludeSwitches: jest.fn(),
  addArguments: jest.fn(),
};
const mockFirefoxOptions = {
  setPageLoadStrategy: jest.fn(),
  addArguments: jest.fn(),
};
const mockSetTimeouts = jest.fn().mockResolvedValue(undefined);
const mockDriver = {
  sendDevToolsCommand: jest.fn().mockResolvedValue(undefined),
  manage: jest.fn(() => ({
    setTimeouts: mockSetTimeouts,
  })),
};
const mockBuilder = {
  forBrowser: jest.fn().mockReturnThis(),
  setChromeOptions: jest.fn().mockReturnThis(),
  setFirefoxOptions: jest.fn().mockReturnThis(),
  build: jest.fn().mockResolvedValue(mockDriver),
};

jest.mock("selenium-webdriver", () => ({
  Builder: jest.fn(() => mockBuilder),
}));

jest.mock("selenium-webdriver/chrome", () => ({
  Options: jest.fn(() => mockChromeOptions),
}));

jest.mock("selenium-webdriver/firefox", () => ({
  Options: jest.fn(() => mockFirefoxOptions),
}));

const BrowserFactory = require("../../src/utils/BrowserFactory");

describe("BrowserFactory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("crea Chrome headless con opciones esperadas", async () => {
    await expect(BrowserFactory.create("chrome", true)).resolves.toBe(mockDriver);

    expect(mockChromeOptions.setPageLoadStrategy).toHaveBeenCalledWith("eager");
    expect(mockChromeOptions.excludeSwitches).toHaveBeenCalledWith("enable-automation");
    expect(mockChromeOptions.addArguments).toHaveBeenCalledWith("--headless=new");
    expect(mockBuilder.forBrowser).toHaveBeenCalledWith("chrome");
    expect(mockBuilder.setChromeOptions).toHaveBeenCalledWith(mockChromeOptions);
    expect(mockDriver.sendDevToolsCommand).toHaveBeenCalled();
    expect(mockSetTimeouts).toHaveBeenCalledWith({
      implicit: 0,
      pageLoad: 30000,
      script: 30000,
    });
  });

  it("crea Firefox con tamaño de ventana", async () => {
    await expect(BrowserFactory.create("firefox", false)).resolves.toBe(mockDriver);

    expect(mockFirefoxOptions.setPageLoadStrategy).toHaveBeenCalledWith("eager");
    expect(mockFirefoxOptions.addArguments).toHaveBeenCalledWith("--width=1920", "--height=1080");
    expect(mockBuilder.forBrowser).toHaveBeenCalledWith("firefox");
    expect(mockBuilder.setFirefoxOptions).toHaveBeenCalledWith(mockFirefoxOptions);
  });

  it("rechaza browsers no soportados", async () => {
    await expect(BrowserFactory.create("safari")).rejects.toThrow(/no soportado/);
  });
});
