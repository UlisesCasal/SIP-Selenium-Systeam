"use strict";

const { By, until } = require("selenium-webdriver");
const logger = require("../utils/logger");
const MERCADOLIBRE = require("../config/selectors");
const FILTER_WAIT = 8000;
const URL_WAIT = 12000;

class FiltersPage {
  constructor(driver, explicitWait = 20000) {
    this.driver = driver;
    this.explicitWait = explicitWait;
  }

  async applyAllFilters(producto) {
    const applied = {
      condicion: await this.applyConditionNuevo(producto),
      tiendaOficial: await this.applyOfficialStore(producto),
      orden: await this.applySortMasRelevantes(producto),
    };
    logger.info(`[FiltersPage] Filtros aplicados: ${JSON.stringify(applied)}`, { producto });
    return applied;
  }

  async applyConditionNuevo(producto) {
    return this._safeApply("Condición Nuevo", producto, async () => {
      const link = await this._findFirst([
        By.css('aside a.ui-search-link[href*="/nuevo/"]'),
        By.css('aside a[href*="/nuevo/"]'),
        By.xpath('//aside//a[normalize-space()="Nuevo"]'),
      ]);
      if (!link) {
        logger.warn(`[FiltersPage] Filtro Condición Nuevo no disponible`, { producto });
        return false;
      }
      return this._clickAndWait(link);
    });
  }

  async applyOfficialStore(producto) {
    return this._safeApply("Solo tiendas oficiales", producto, async () => {
      const link = await this._findFirst([
        By.css('aside a.ui-search-link[href*="_Tienda_"]'),
        By.css('aside a[href*="_Tienda_"]'),
        By.xpath(
          '//aside//a[contains(translate(normalize-space(), "TIENDAS OFICIALES", "tiendas oficiales"), "tiendas oficiales")]',
        ),
      ]);
      if (!link) {
        logger.warn(`[FiltersPage] Filtro tienda_oficial no disponible`, { producto });
        return false;
      }
      return this._clickAndWait(link);
    });
  }

  async applySortMasRelevantes(producto) {
    return this._safeApply("Orden Más relevantes", producto, async () => {
      const currentText = await this.driver.findElements(
        By.xpath(
          '//*[contains(normalize-space(),"Más relevantes") or contains(normalize-space(),"Mas relevantes")]',
        ),
      );
      return currentText.length > 0;
    });
  }

  async _safeApply(label, producto, fn) {
    try {
      logger.info(`[FiltersPage] Aplicando ${label}`, { producto });
      const applied = await fn();
      if (!applied) logger.warn(`[FiltersPage] No se pudo aplicar ${label}`, { producto });
      return Boolean(applied);
    } catch (error) {
      logger.warn(`[FiltersPage] ${label} falló: ${error.message}`, { producto });
      return false;
    }
  }

  async _findFirst(locators) {
    const endTime = Date.now() + FILTER_WAIT;

    while (Date.now() < endTime) {
      for (const locator of locators) {
        try {
          return await this.driver.wait(until.elementLocated(locator), 500);
        } catch {
          // ignorar y probar siguiente selector
        }
      }
    }
    return null;
  }

  async _clickAndWait(element) {
    const previousUrl = await this.driver.getCurrentUrl();
    await this.driver.executeScript(
      'arguments[0].scrollIntoView({ block:"center" })',
      element,
    );
    await this.driver
      .wait(until.elementIsVisible(element), 3000)
      .catch(() => {});
    await element.click();

    await this.driver
      .wait(async () => {
        const url = await this.driver.getCurrentUrl();
        return url !== previousUrl;
      }, URL_WAIT)
      .catch(() => {});

    if (await this._isLoginWall()) {
      logger.warn(
        "[FiltersPage] Muro de login detectado, volviendo a resultados.",
      );
      await this.driver.navigate().back();
      await this._waitForResults().catch(() => {});
      return false;
    }

    await this._waitForResults();
    return true;
  }

  async _isLoginWall() {
    const url = await this.driver.getCurrentUrl();
    if (/\/login|registration/i.test(url)) return true;
    const markers = await this.driver.findElements(
      By.xpath(
        '//*[contains(text(),"Para continuar") or contains(text(),"Ya tengo cuenta") or contains(text(),"Soy nuevo")]',
      ),
    );
    return markers.length > 0;
  }

  async _waitForResults() {
    const combinedSelector = MERCADOLIBRE.results.item
      .map((loc) => loc.value)
      .join(", ");

    try {
      await this.driver.wait(
        until.elementLocated(By.css(combinedSelector)),
        this.explicitWait,
      );
    } catch {
      throw new Error(
        "No aparecieron resultados después del filtro en el tiempo límite.",
      );
    }
  }
}

module.exports = FiltersPage;
