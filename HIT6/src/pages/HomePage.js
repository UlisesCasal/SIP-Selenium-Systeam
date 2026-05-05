"use strict";

const { By, until, Key } = require("selenium-webdriver");
const logger = require("../utils/logger");
const MERCADOLIBRE = require("../config/selectors");

const BASE_URL = "https://www.mercadolibre.com.ar";

class HomePage {
  constructor(driver, explicitWait = 20000) {
    this.driver = driver;
    this.explicitWait = explicitWait;
    this.homeInputAvailable = false;
  }

  async open() {
    logger.info("[HomePage] Abriendo página", {
      event: "page_open",
      url: BASE_URL,
    });
    await this.driver.get(BASE_URL);
    await this._waitForSearchInput();
  }

  async search(query) {
    logger.info("[HomePage] Iniciando búsqueda", {
      event: "search_start",
      query: query,
    });
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

    const combinedSelector = MERCADOLIBRE.home.searchInput
      .map((loc) => loc.value)
      .join(", ");

    try {
      const element = await this.driver.wait(
        until.elementLocated(By.css(combinedSelector)),
        timeout,
      );

      await this.driver
        .wait(until.elementIsVisible(element), 3000)
        .catch(() => {});

      return element;
    } catch (error) {
      throw new Error(`No se encontró el input de búsqueda tras ${timeout}ms.`);
    }
  }
}

module.exports = HomePage;
