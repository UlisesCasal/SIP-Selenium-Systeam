'use strict';

const { By, until } = require('selenium-webdriver');
const logger = require('../utils/logger');

const BASE_URL = 'https://www.mercadolibre.com.ar';

const SEARCH_INPUT_LOCATORS = [
  By.css('input.nav-search-input'),
  By.css('input[name="as_word"]'),
  By.css('#cb1-edit'),
];

const SEARCH_BUTTON_LOCATORS = [
  By.css('button.nav-search-btn'),
  By.css('form.nav-search-form button[type="submit"]'),
  By.css('button[type="submit"]'),
];

/**
 * Page Object — Página principal de MercadoLibre Argentina.
 * Recibe el explicitWait del BrowserOptions para mantener los timeouts consistentes.
 */
class HomePage {
  /**
   * @param {import('selenium-webdriver').WebDriver} driver
   * @param {number} explicitWait — ms máximos para explicit waits
   */
  constructor(driver, explicitWait = 20000) {
    this.driver = driver;
    this.explicitWait = explicitWait;
  }

  async open() {
    logger.info(`Navigating to ${BASE_URL}`);
    await this.driver.get(BASE_URL);
    await this._waitForSearchInput();
    logger.info('Home page loaded');
  }

  async search(query) {
    logger.info(`Searching for: "${query}"`);
    const input = await this._waitForSearchInput();
    await input.clear();
    await input.sendKeys(query);

    const button = await this._findFirst(SEARCH_BUTTON_LOCATORS);
    await button.click();
    logger.info('Search submitted');
  }

  async _waitForSearchInput() {
    for (const locator of SEARCH_INPUT_LOCATORS) {
      try {
        const el = await this.driver.wait(until.elementLocated(locator), this.explicitWait);
        logger.info(`Search input found: ${locator.toString()}`);
        return el;
      } catch {
        // probar siguiente
      }
    }
    throw new Error('Search input not found on home page');
  }

  async _findFirst(locators) {
    for (const locator of locators) {
      try {
        return await this.driver.findElement(locator);
      } catch {
        // probar siguiente
      }
    }
    throw new Error('No element found from locator list');
  }
}

module.exports = HomePage;
