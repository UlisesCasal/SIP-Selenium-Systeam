"use strict";

const { Builder } = require("selenium-webdriver");
const chrome = require("selenium-webdriver/chrome");
const firefox = require("selenium-webdriver/firefox");
const BrowserOptions = require("./BrowserOptions");
const logger = require("./logger");

/**
 * Browser Factory — única responsabilidad: construir instancias de WebDriver.
 */
class BrowserFactory {
  static async fromCli() {
    const opts = BrowserOptions.fromCli();
    return BrowserFactory.create(opts);
  }

  static async create(options) {
    if (!(options instanceof BrowserOptions)) {
      options = new BrowserOptions(options);
    }

    logger.info(`[BrowserFactory] ${options}`);

    let driver;
    switch (options.browser) {
      case "chrome":
        driver = await BrowserFactory._buildChrome(options);
        break;
      case "firefox":
        driver = await BrowserFactory._buildFirefox(options);
        break;
      default:
        throw new Error(`Browser "${options.browser}" no soportado.`);
    }

    await driver.manage().setTimeouts({
      implicit: 0,
      pageLoad: options.pageLoadTimeout,
      script: options.scriptTimeout,
    });

    await BrowserFactory._logCapabilities(driver, options.browser);
    return driver;
  }

  static async _buildChrome(opts) {
    const options = new chrome.Options();

    if (opts.headless) {
      options.addArguments("--headless=new");
    }

    options.addArguments(
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      `--window-size=${opts.windowWidth},${opts.windowHeight}`,
      "--disable-blink-features=AutomationControlled"
    );

    options.excludeSwitches("enable-automation");
    options.setPageLoadStrategy("eager");

    const driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

    // Stealth: ocultar navigator.webdriver
    await driver.executeScript(
      "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
    );

    return driver;
  }

  static async _buildFirefox(opts) {
    const options = new firefox.Options();

    if (opts.headless) {
      options.addArguments("--headless");
    }

    options.addArguments(
      `--width=${opts.windowWidth}`,
      `--height=${opts.windowHeight}`
    );

    options.setPreference("dom.webdriver.enabled", false);
    options.setPreference("useAutomationExtension", false);
    options.setPageLoadStrategy("eager");

    return new Builder()
      .forBrowser("firefox")
      .setFirefoxOptions(options)
      .build();
  }

  static async _logCapabilities(driver, browserName) {
    try {
      const caps = await driver.getCapabilities();
      const version =
        caps.get("browserVersion") || caps.get("version") || "unknown";
      const platform =
        caps.get("platformName") || caps.get("platform") || "unknown";
      logger.info(
        `[BrowserFactory] ${browserName} v${version} on ${platform} — driver ready`,
      );
    } catch {
      logger.info(
        `[BrowserFactory] ${browserName} driver ready (capabilities not available)`,
      );
    }
  }
}

module.exports = BrowserFactory;
