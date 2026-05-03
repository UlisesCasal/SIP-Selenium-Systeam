'use strict';

const { parseProducts } = require('./products');

const SUPPORTED_BROWSERS = ['chrome', 'firefox'];

function envBool(name, fallback) {
  if (process.env[name] === undefined) return fallback;
  return String(process.env[name]).toLowerCase() === 'true';
}

function envInt(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) ? value : fallback;
}

class ScraperConfig {
  constructor({
    browser = process.env.BROWSER || 'chrome',
    headless = envBool('HEADLESS', false),
    products = parseProducts(),
    resultLimit = envInt('RESULT_LIMIT', 30),
    maxRetries = envInt('MAX_RETRIES', 3),
    explicitWait = envInt('EXPLICIT_WAIT_MS', 20000),
    pageLoadTimeout = envInt('PAGE_LOAD_TIMEOUT_MS', 120000),
    scriptTimeout = envInt('SCRIPT_TIMEOUT_MS', 60000),
    windowWidth = envInt('WINDOW_WIDTH', 1920),
    windowHeight = envInt('WINDOW_HEIGHT', 1080),
    outputDir = process.env.OUTPUT_DIR || 'output',
    logDir = process.env.LOG_DIR || 'logs',
    applyFilters = envBool('APPLY_FILTERS', true),
  } = {}) {
    this.browser = browser.toLowerCase().trim();
    this.headless = Boolean(headless);
    this.products = products;
    this.resultLimit = resultLimit;
    this.maxRetries = maxRetries;
    this.explicitWait = explicitWait;
    this.pageLoadTimeout = pageLoadTimeout;
    this.scriptTimeout = scriptTimeout;
    this.windowWidth = windowWidth;
    this.windowHeight = windowHeight;
    this.outputDir = outputDir;
    this.logDir = logDir;
    this.applyFilters = Boolean(applyFilters);
    this._validate();
  }

  static fromEnv() {
    const browserFromArg = process.argv.find((arg) => SUPPORTED_BROWSERS.includes(arg));
    const headlessFromArg = process.argv.includes('--headless');
    return new ScraperConfig({
      browser: process.env.BROWSER || browserFromArg || 'chrome',
      headless: envBool('HEADLESS', headlessFromArg),
    });
  }

  _validate() {
    if (!SUPPORTED_BROWSERS.includes(this.browser)) {
      throw new Error(`Browser no soportado: ${this.browser}. Use ${SUPPORTED_BROWSERS.join(', ')}.`);
    }
    if (!Array.isArray(this.products) || this.products.length === 0) {
      throw new Error('Debe configurarse al menos un producto.');
    }
    if (this.resultLimit < 1) throw new Error('RESULT_LIMIT debe ser mayor a 0.');
    if (this.maxRetries < 0) throw new Error('MAX_RETRIES no puede ser negativo.');
  }

  toBrowserOptions() {
    return {
      browser: this.browser,
      headless: this.headless,
      windowWidth: this.windowWidth,
      windowHeight: this.windowHeight,
      pageLoadTimeout: this.pageLoadTimeout,
      scriptTimeout: this.scriptTimeout,
      explicitWait: this.explicitWait,
    };
  }
}

module.exports = ScraperConfig;
