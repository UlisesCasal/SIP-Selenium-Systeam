'use strict';

const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const firefox = require('selenium-webdriver/firefox');
const logger = require('./logger');

class BrowserFactory {
  static async create(browserName = 'chrome', headless = false) {
    logger.info(`Creating ${browserName} driver (headless=${headless})`);

    let driver;

    switch (browserName.toLowerCase()) {
      case 'chrome': {
        const options = new chrome.Options();

        // Stealth flags solicitados
        options.excludeSwitches('enable-automation');
        options.addArguments('--disable-blink-features=AutomationControlled');
        options.addArguments('--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        if (headless) {
          // --headless=new: Chrome 112+ nueva implementación headless
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

        // Stealth Chrome: Ocultar navigator.webdriver
        await driver.sendAndGetDevToolsCommand('Page.addScriptToEvaluateOnNewDocument', {
          source: `
            Object.defineProperty(navigator, 'webdriver', {
              get: () => undefined
            });
          `
        });
        break;
      }

      case 'firefox': {
        const options = new firefox.Options();
        
        // Stealth Firefox: Ocultar navigator.webdriver y extensiones de automatización
        options.setPreference('dom.webdriver.enabled', false);
        options.setPreference('useAutomationExtension', false);
        
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

    return driver;
  }
}

module.exports = BrowserFactory;
