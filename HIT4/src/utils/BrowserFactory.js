'use strict';

const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const logger = require('./logger');

class BrowserFactory {
  static async create(options) {
    logger.info(`[BrowserFactory] browser=${options.browser} headless=${options.headless}`);

    let driver;
    if (options.browser === 'chrome') {
      driver = await this._buildChrome(options);
    } else if (options.browser === 'firefox') {
      driver = await this._buildFirefox(options);
    } else {
      throw new Error(`Browser no soportado: ${options.browser}`);
    }

    await driver.manage().setTimeouts({
      implicit: 0,
      pageLoad: options.pageLoadTimeout,
      script: options.scriptTimeout,
    });

    return driver;
  }

  static _buildChrome(options) {
    const browserOptions = new chrome.Options();
    if (process.env.CHROME_BIN) browserOptions.setChromeBinaryPath(process.env.CHROME_BIN);
    if (options.headless) browserOptions.addArguments('--headless=new');
    browserOptions.addArguments(
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-notifications',
      '--lang=es-AR',
      '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      `--window-size=${options.windowWidth},${options.windowHeight}`
    );
    browserOptions.setPageLoadStrategy('eager');
    return new Builder().forBrowser('chrome').setChromeOptions(browserOptions).build();
  }

  static _buildFirefox(options) {
    const browserOptions = new firefox.Options();
    if (options.headless) browserOptions.addArguments('--headless');
    browserOptions.addArguments(
      '--lang=es-AR',
      `--width=${options.windowWidth}`,
      `--height=${options.windowHeight}`
    );
    browserOptions.setPageLoadStrategy('eager');
    return new Builder().forBrowser('firefox').setFirefoxOptions(browserOptions).build();
  }
}

module.exports = BrowserFactory;
