const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const logger = require('./logger');

/**
 * Browser Factory — centraliza la creación de drivers WebDriver.
 * Selenium 4.x incluye Selenium Manager que descarga los drivers
 * automáticamente: no se necesita chromedriver/geckodriver instalados a mano.
 */
class BrowserFactory {
  /**
   * @param {'chrome'|'firefox'} browserName
   * @param {boolean} headless
   * @returns {Promise<import('selenium-webdriver').WebDriver>}
   */
  static async create(browserName = 'chrome', headless = false) {
    logger.info(`Creating ${browserName} driver (headless=${headless})`);

    let driver;

    switch (browserName.toLowerCase()) {
      case 'chrome': {
        const options = new chrome.Options();

        // Page load 'eager' = retorna apenas DOMContentLoaded, sin esperar
        // imágenes/ads/analytics. Crítico para sitios pesados como ML.
        options.setPageLoadStrategy('eager');

        options.excludeSwitches('enable-automation');
        options.addArguments('--disable-blink-features=AutomationControlled');
        options.addArguments(
          '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
        );
        options.addArguments(
          '--lang=es-AR',
          '--accept-lang=es-AR,es,en',
          '--disable-infobars',
          '--disable-extensions',
          '--disable-popup-blocking',
          '--no-first-run',
          '--no-default-browser-check',
        );

        if (headless) {
          options.addArguments('--headless=new');
        }
        options.addArguments(
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--window-size=1920,1080'
        );
        driver = await new Builder()
          .forBrowser('chrome')
          .setChromeOptions(options)
          .build();

        // Ocultar navigator.webdriver en cada nuevo documento (CDP)
        await driver.sendDevToolsCommand(
          'Page.addScriptToEvaluateOnNewDocument',
          { source: 'Object.defineProperty(navigator,"webdriver",{get:()=>undefined});' }
        ).catch(() => {});

        break;
      }

      case 'firefox': {
        const options = new firefox.Options();
        options.setPageLoadStrategy('eager');
        if (headless) {
          options.addArguments('--headless');
        }
        options.addArguments('--width=1920', '--height=1080');
        driver = await new Builder()
          .forBrowser('firefox')
          .setFirefoxOptions(options)
          .build();
        break;
      }

      default:
        throw new Error(
          `Browser '${browserName}' no soportado. Usar 'chrome' o 'firefox'.`
        );
    }

    await driver.manage().setTimeouts({
      implicit: 0,   // sin implicit wait — usamos explicit waits explícitos
      pageLoad: 30000,
      script: 30000,
    });

    logger.info(`${browserName} driver ready`);
    return driver;
  }
}

module.exports = BrowserFactory;
