const { By, until } = require('selenium-webdriver');
const logger = require('../utils/logger');

const BASE_URL = 'https://www.mercadolibre.com.ar';
const WAIT_MS = 15000;

/**
 * Page Object — Página principal de MercadoLibre Argentina.
 * Encapsula todos los selectores e interacciones de la home.
 */
class HomePage {
  constructor(driver) {
    this.driver = driver;

    // Estrategia de selectores: múltiples alternativas en orden de preferencia.
    // MercadoLibre actualiza sus clases frecuentemente; tener fallbacks mejora
    // la resiliencia del scraper sin requerir cambios en el código cliente.
    this.searchInputLocators = [
      By.css('input.nav-search-input'),
      By.css('input[name="as_word"]'),
      By.css('#cb1-edit'),
    ];

    this.searchButtonLocators = [
      By.css('button.nav-search-btn'),
      By.css('button[type="submit"].nav-search-btn'),
      By.css('form.nav-search-form button[type="submit"]'),
    ];
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

    const button = await this._findFirstLocated(this.searchButtonLocators);
    await button.click();

    logger.info('Search submitted');
  }

  async _waitForSearchInput() {
    for (const locator of this.searchInputLocators) {
      try {
        const el = await this.driver.wait(until.elementLocated(locator), WAIT_MS);
        logger.info(`Search input found with: ${locator.toString()}`);
        return el;
      } catch {
        // intentar siguiente selector
      }
    }
    throw new Error('No se encontró el input de búsqueda en la home');
  }

  async _findFirstLocated(locators) {
    for (const locator of locators) {
      try {
        return await this.driver.findElement(locator);
      } catch {
        // intentar siguiente
      }
    }
    throw new Error('No se encontró ninguno de los locators provistos');
  }
}

module.exports = HomePage;
