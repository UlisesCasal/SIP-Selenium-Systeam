"use strict";

const { By, until, Key } = require("selenium-webdriver");
const logger = require("../utils/logger");

const BASE_URL = "https://www.mercadolibre.com.ar";

const SEARCH_INPUT_LOCATORS = [
  By.css("input.nav-search-input"),
  By.css('input[name="as_word"]'),
  By.css("#cb1-edit"),
];

const SEARCH_BUTTON_LOCATORS = [
  By.css("button.nav-search-btn"),
  By.css('form.nav-search-form button[type="submit"]'),
  By.css('button[type="submit"]'),
];

class HomePage {
  constructor(driver, explicitWait = 20000) {
    this.driver = driver;
    this.explicitWait = explicitWait;
    this.homeInputAvailable = false;
  }

  async open() {
    logger.info(`[HomePage] Abriendo ${BASE_URL}`);
    await this.driver.get(BASE_URL);
    await this._waitForSearchInput();
  }

  async search(query) {
    logger.info(`[HomePage] Buscando "${query}"`);
    const input = await this._waitForSearchInput();
    await input.clear();
    await input.sendKeys(query, Key.ENTER);
  }

  async _waitForSearchInput(timeout = this.explicitWait) {
    const isBlocked = await this.driver.findElements(
      By.xpath('//*[contains(text(),"ingresa a tu cuenta")]'),
    );
    if (isBlocked.length > 0) {
      throw new Error("BOT DETECTADO: Mercado Libre pide login.");
    }
    for (const locator of SEARCH_INPUT_LOCATORS) {
      try {
        const element = await this.driver.wait(
          until.elementLocated(locator),
          timeout,
        );
        await this.driver
          .wait(until.elementIsVisible(element), 3000)
          .catch(() => {});
        return element;
      } catch {
        // probar selector siguiente
      }
    }
    throw new Error("No se encontró el input de búsqueda.");
  }

  async _findFirst(locators) {
    for (const locator of locators) {
      try {
        return await this.driver.findElement(locator);
      } catch {
        // probar selector siguiente
      }
    }
    return null;
  }
}

module.exports = HomePage;
