"use strict";

const SUPPORTED_BROWSERS = ["chrome", "firefox"];

/**
 * Value object que encapsula toda la configuración de un WebDriver.
 * Separar la configuración de la construcción permite:
 *   - Testear la lectura de CLI/env sin arrancar un browser real.
 *   - Pasar opciones entre módulos sin acoplarlos a BrowserFactory.
 *   - Validar la configuración antes de gastar tiempo creando el driver.
 */
class BrowserOptions {
  /**
   * @param {object} opts
   * @param {'chrome'|'firefox'} opts.browser
   * @param {boolean}            opts.headless
   * @param {number}             opts.windowWidth
   * @param {number}             opts.windowHeight
   * @param {number}             opts.pageLoadTimeout  ms
   * @param {number}             opts.scriptTimeout    ms
   * @param {number}             opts.explicitWait     ms — tiempo máximo para explicit waits
   */
  constructor({
    browser = "chrome",
    headless = false,
    windowWidth = 1920,
    windowHeight = 1080,
    pageLoadTimeout = 30000,
    scriptTimeout = 30000,
    explicitWait = 20000,
  } = {}) {
    this.browser = browser.toLowerCase().trim();
    this.headless = Boolean(headless);
    this.windowWidth = windowWidth;
    this.windowHeight = windowHeight;
    this.pageLoadTimeout = pageLoadTimeout;
    this.scriptTimeout = scriptTimeout;
    this.explicitWait = explicitWait;

    this._validate();
  }

  /**
   * Lee configuración desde variables de entorno y argumentos de línea de comandos.
   *
   * Precedencia (mayor a menor):
   *   1. Variable de entorno  BROWSER / HEADLESS
   *   2. Argumento CLI        node script.js chrome --headless
   *   3. Valor por defecto    chrome / false
   *
   * @param {string} [defaultBrowser='chrome']
   * @returns {BrowserOptions}
   */
  static fromCli(defaultBrowser = "chrome") {
    const browser =
      process.env.BROWSER ||
      process.argv.find((a) => SUPPORTED_BROWSERS.includes(a.toLowerCase())) ||
      defaultBrowser;

    const headless =
      process.env.HEADLESS === "true" || process.argv.includes("--headless");

    return new BrowserOptions({ browser, headless });
  }

  /** @returns {string[]} */
  static getSupportedBrowsers() {
    return [...SUPPORTED_BROWSERS];
  }

  _validate() {
    if (!SUPPORTED_BROWSERS.includes(this.browser)) {
      throw new Error(
        `Browser "${this.browser}" no soportado. Opciones válidas: ${SUPPORTED_BROWSERS.join(", ")}.`,
      );
    }
    if (this.windowWidth < 1 || this.windowHeight < 1) {
      throw new Error("windowWidth y windowHeight deben ser mayores a 0.");
    }
  }

  toString() {
    return `BrowserOptions(browser=${this.browser}, headless=${this.headless}, ${this.windowWidth}x${this.windowHeight})`;
  }
}

module.exports = BrowserOptions;
