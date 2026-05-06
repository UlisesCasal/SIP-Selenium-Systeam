"use strict";

jest.mock("../../src/utils/logger", () => ({
  info: jest.fn(),
}));

const mockChromeOptions = {
  excludeSwitches: jest.fn(),
  addArguments: jest.fn(),
};
const mockFirefoxOptions = {
  addArguments: jest.fn(),
};
const mockDriver = {};
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

  it("crea Chrome con flags stealth y headless", async () => {
    await expect(BrowserFactory.create("chrome", true)).resolves.toBe(mockDriver);

    expect(mockChromeOptions.excludeSwitches).toHaveBeenCalledWith("enable-automation");
    expect(mockChromeOptions.addArguments).toHaveBeenCalledWith("--headless=new");
    expect(mockBuilder.forBrowser).toHaveBeenCalledWith("chrome");
    expect(mockBuilder.setChromeOptions).toHaveBeenCalledWith(mockChromeOptions);
  });

  it("crea Firefox con headless y tamaño de ventana", async () => {
    await expect(BrowserFactory.create("firefox", true)).resolves.toBe(mockDriver);

    expect(mockFirefoxOptions.addArguments).toHaveBeenCalledWith("--headless");
    expect(mockFirefoxOptions.addArguments).toHaveBeenCalledWith("--width=1920", "--height=1080");
    expect(mockBuilder.forBrowser).toHaveBeenCalledWith("firefox");
    expect(mockBuilder.setFirefoxOptions).toHaveBeenCalledWith(mockFirefoxOptions);
  });

  it("rechaza browsers no soportados", async () => {
    await expect(BrowserFactory.create("safari")).rejects.toThrow(/no soportado/);
  });
});
