'use strict';

const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const BrowserOptions = require('./BrowserOptions');
const logger = require('./logger');

/**
 * Browser Factory — única responsabilidad: construir instancias de WebDriver.
 *
 * Refactoring respecto a HIT #1:
 *   - `create()` ahora recibe un BrowserOptions en lugar de parámetros sueltos.
 *   - `fromCli()` es el punto de entrada estándar: lee env/args y construye el driver.
 *   - Los adaptadores por browser están en métodos privados, haciendo el switch más limpio.
 *   - Se loguean las capabilities detectadas para facilitar la comparación Chrome/Firefox.
 */
class BrowserFactory {
  /**
   * Lee la configuración de env/args y crea el driver.
   * Forma idiomática para los scripts de scraping.
   *
   * @example
   *   // BROWSER=firefox node scraper.js
   *   // node scraper.js firefox --headless
   *   const driver = await BrowserFactory.fromCli();
   *
   * @returns {Promise<import('selenium-webdriver').WebDriver>}
   */
  static async fromCli() {
    const opts = BrowserOptions.fromCli();
    return BrowserFactory.create(opts);
  }

  /**
   * Crea un WebDriver configurado a partir de un BrowserOptions.
   *
   * @param {BrowserOptions} options
   * @returns {Promise<import('selenium-webdriver').WebDriver>}
   */
  static async create(options) {
    if (!(options instanceof BrowserOptions)) {
      // Permite pasar un plain object por conveniencia en tests
      options = new BrowserOptions(options);
    }

    logger.info(`[BrowserFactory] ${options}`);

    let driver;
    switch (options.browser) {
      case 'chrome':
        driver = await BrowserFactory._buildChrome(options);
        break;
      case 'firefox':
        driver = await BrowserFactory._buildFirefox(options);
        break;
      default:
        throw new Error(`Browser "${options.browser}" no soportado.`);
    }

    await driver.manage().setTimeouts({
      implicit: 0,                        // 0 = usamos sólo explicit waits
      pageLoad: options.pageLoadTimeout,
      script: options.scriptTimeout,
    });

    await BrowserFactory._logCapabilities(driver, options.browser);
    return driver;
  }

  // ── Constructores por browser ──────────────────────────────────────────────

  static async _buildChrome(opts) {
    const options = new chrome.Options();

    if (opts.headless) {
      // --headless=new: implementación headless moderna (Chrome ≥ 112).
      // La flag legacy --headless usaba un renderer diferente que podía
      // producir diferencias de renderizado vs el modo con ventana.
      options.addArguments('--headless=new');
    }

    options.addArguments(
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      `--window-size=${opts.windowWidth},${opts.windowHeight}`
    );

    return new Builder().forBrowser('chrome').setChromeOptions(options).build();
  }

  static async _buildFirefox(opts) {
    const options = new firefox.Options();

    if (opts.headless) {
      options.addArguments('--headless');
    }

    // Firefox acepta dimensiones como argumentos directos
    options.addArguments(
      `--width=${opts.windowWidth}`,
      `--height=${opts.windowHeight}`
    );

    return new Builder().forBrowser('firefox').setFirefoxOptions(options).build();
  }

  // ── Diagnóstico ────────────────────────────────────────────────────────────

  static async _logCapabilities(driver, browserName) {
    try {
      const caps = await driver.getCapabilities();
      const version = caps.get('browserVersion') || caps.get('version') || 'unknown';
      const platform = caps.get('platformName') || caps.get('platform') || 'unknown';
      logger.info(`[BrowserFactory] ${browserName} v${version} on ${platform} — driver ready`);
    } catch {
      logger.info(`[BrowserFactory] ${browserName} driver ready (capabilities not available)`);
    }
  }
}

module.exports = BrowserFactory;
