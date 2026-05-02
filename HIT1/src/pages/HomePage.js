const { By, until } = require('selenium-webdriver');
const logger = require('../utils/logger');

const BASE_URL = 'https://www.mercadolibre.com.ar';
const LISTADO_BASE = 'https://listado.mercadolibre.com.ar';
const WAIT_MS = 15000;

function slugify(query) {
  return query
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

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
    // Navegación directa al subdominio listado.mercadolibre.com.ar para evitar
    // que el submit del search box dispare account-verification en CI/cloud IPs.
    const url = `${LISTADO_BASE}/${slugify(query)}`;
    logger.info(`Navigating directly to: ${url}`);
    await this.driver.get(url);
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

    logger.error('Timeout esperando el input de búsqueda. Tomando screenshot para debug visual...');
    try {
      const fs = require('fs');
      const path = require('path');
      const screenshot = await this.driver.takeScreenshot();
      
      const outputDir = path.resolve(__dirname, '../../output');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filePath = path.join(outputDir, 'error-home-captura.png');
      fs.writeFileSync(filePath, screenshot, 'base64');
      logger.info(`Screenshot guardado en: ${filePath}`);
    } catch (err) {
      logger.error('No se pudo tomar el screenshot de debug: ' + err.message);
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
