"use strict";

const { By, until } = require("selenium-webdriver");
const logger = require("../utils/logger");

const FILTER_WAIT = 8000;
const RELOAD_WAIT = 20000;
const URL_WAIT = 12000;

const RESULTS_LOCATORS = [
  By.css("li.ui-search-layout__item"),
  By.css(".ui-search-results .ui-search-layout__item"),
  By.css(".poly-card"),
];

const SORT_TEXTS = ["Más relevantes", "Mas relevantes", "relevante"];

/**
 * Page Object — Filtros de MercadoLibre Argentina.
 *
 * Selectores basados en diagnóstico DOM real (2026-04):
 *
 *   Condición "Nuevo":
 *     - class del link   : "ui-search-link"
 *     - parent class     : "ui-search-filter-container"
 *     - texto visible    : "Nuevo"
 *     - href (path)      : .../rodado-29/nuevo/hombre/...   ← "/nuevo/" como segmento
 *
 *   Tienda oficial:
 *     - texto visible    : "Solo tiendas oficiales"
 *     - href (path)      : ..._Tienda_all_...               ← "_Tienda_" en la URL
 *
 * NUNCA buscar filtros fuera de <aside> para evitar falsos positivos
 * (badges de producto, CTAs de login, etc.)
 */
class FiltersPage {
  constructor(driver, explicitWait = RELOAD_WAIT) {
    this.driver = driver;
    this.explicitWait = explicitWait;
  }

  async applyAllFilters() {
    const applied = { condicion: false, tiendaOficial: false, orden: false };
    applied.condicion = await this.applyConditionNuevo();
    applied.tiendaOficial = await this.applyOfficialStoreSi();
    applied.orden = await this.applySortMasRelevantes();
    logger.info(`[FiltersPage] Resultado: ${JSON.stringify(applied)}`);
    return applied;
  }

  // ── Condición: Nuevo ───────────────────────────────────────────────────────

  async applyConditionNuevo() {
    logger.info("[FiltersPage] → Condición: Nuevo");
    try {
      const link = await this._findConditionNuevo();
      if (!link) throw new Error("no encontrado");
      await this._scrollIntoView(link);
      const ok = await this._clickAndWait(link, "Condición:Nuevo");
      if (!ok) throw new Error("click no produjo resultados válidos");
      logger.info("[FiltersPage] ✓ Condición: Nuevo");
      return true;
    } catch (e) {
      logger.warn(`[FiltersPage] ✗ Condición:Nuevo — ${e.message}`);
      return false;
    }
  }

  async _findConditionNuevo() {
    // Estrategia 1 — CSS exacto: link dentro de aside con "/nuevo/" en href
    // (segmento de path que MercadoLibre usa para el filtro de condición Nuevo)
    for (const sel of [
      'aside a.ui-search-link[href*="/nuevo/"]',
      'aside a[href*="/nuevo/"]',
    ]) {
      const el = await this._cssFirst(sel, "Nuevo");
      if (el) {
        logger.info(`[FiltersPage] Condición por CSS href "/nuevo/": ${sel}`);
        return el;
      }
    }

    // Estrategia 2 — XPath: texto exacto "Nuevo" dentro de aside
    for (const xp of [
      '//aside//a[normalize-space()="Nuevo"]',
      '//aside//li[contains(@class,"ui-search-filter-container")]//a[normalize-space()="Nuevo"]',
    ]) {
      const el = await this._xpathFirst(xp);
      if (el) {
        logger.info(`[FiltersPage] Condición por XPath texto: ${xp}`);
        return el;
      }
    }

    // Estrategia 3 — fallback: cualquier link con clase ui-search-link y texto "Nuevo"
    const el = await this._xpathFirst(
      '//a[contains(@class,"ui-search-link") and normalize-space()="Nuevo"]',
    );
    if (el) {
      logger.info("[FiltersPage] Condición por fallback clase+texto");
      return el;
    }

    return null;
  }

  // ── Tienda oficial: Sí ────────────────────────────────────────────────────

  async applyOfficialStoreSi() {
    logger.info("[FiltersPage] → Tienda oficial: Solo tiendas oficiales");
    try {
      const link = await this._findOfficialStore();
      if (!link) throw new Error("no encontrado");
      await this._scrollIntoView(link);
      const ok = await this._clickAndWait(link, "TiendaOficial");
      if (!ok) throw new Error("click no produjo resultados válidos");
      logger.info("[FiltersPage] ✓ Tienda oficial");
      return true;
    } catch (e) {
      logger.warn(`[FiltersPage] ✗ Tienda oficial — ${e.message}`);
      return false;
    }
  }

  async _findOfficialStore() {
    // Estrategia 1 — CSS: href contiene "_Tienda_" (patrón real observado)
    for (const sel of [
      'aside a.ui-search-link[href*="_Tienda_"]',
      'aside a[href*="_Tienda_"]',
    ]) {
      const el = await this._cssFirst(sel, "");
      if (el) {
        logger.info(`[FiltersPage] Tienda por CSS href "_Tienda_": ${sel}`);
        return el;
      }
    }

    // Estrategia 2 — XPath: texto visible "Solo tiendas oficiales"
    for (const xp of [
      '//aside//a[contains(normalize-space(),"tiendas oficiales")]',
      '//aside//a[normalize-space()="Solo tiendas oficiales"]',
      '//a[contains(@class,"ui-search-link") and contains(normalize-space(),"tiendas oficiales")]',
    ]) {
      const el = await this._xpathFirst(xp);
      if (el) {
        logger.info(`[FiltersPage] Tienda por XPath texto: ${xp}`);
        return el;
      }
    }

    // Estrategia 3 — href genérico con "tienda" (minúsculas)
    const el = await this._xpathFirst(
      '//aside//a[contains(@href,"tienda") or contains(@href,"Tienda") or contains(@href,"official")]',
    );
    if (el) {
      logger.info("[FiltersPage] Tienda por XPath href genérico");
      return el;
    }

    return null;
  }

  // ── Sort: Más relevantes ──────────────────────────────────────────────────

  async applySortMasRelevantes() {
    logger.info("[FiltersPage] → Sort: Más relevantes");
    if (await this._sortViaSelect()) return true;
    if (await this._sortViaDropdown()) return true;
    logger.warn(
      "[FiltersPage] Sort no encontrado (puede que ya sea el default)",
    );
    return false;
  }

  // ── Helpers privados ──────────────────────────────────────────────────────

  /**
   * Devuelve el primer <a> que matchee el selector CSS y opcionalmente
   * tenga texto que empiece con textHint (case-insensitive).
   */
  async _cssFirst(selector, textHint) {
    try {
      const els = await this.driver.findElements(By.css(selector));
      for (const el of els) {
        if (!textHint) return el;
        const text = (await el.getText()).trim().toLowerCase();
        if (text.startsWith(textHint.toLowerCase())) return el;
      }
      return null;
    } catch {
      return null;
    }
  }

  async _xpathFirst(xpath) {
    try {
      return await this.driver.wait(
        until.elementLocated(By.xpath(xpath)),
        FILTER_WAIT,
      );
    } catch {
      return null;
    }
  }

  async _scrollIntoView(el) {
    await this.driver.executeScript(
      'arguments[0].scrollIntoView({ behavior:"instant", block:"center" })',
      el,
    );
    await this.driver.wait(until.elementIsVisible(el), 3000).catch(() => {});
  }

  /** Click real + espera de URL + resultados. Retorna false si aparece muro de login. */
  async _clickAndWait(element, name) {
    const urlBefore = await this.driver.getCurrentUrl();
    logger.info(
      `[FiltersPage] Click "${name}" | URL: ...${urlBefore.slice(-70)}`,
    );
    await element.click();

    // Esperar cambio de URL
    try {
      await this.driver.wait(
        async () => (await this.driver.getCurrentUrl()) !== urlBefore,
        URL_WAIT,
      );
      const urlAfter = await this.driver.getCurrentUrl();
      logger.info(`[FiltersPage] Nueva URL: ...${urlAfter.slice(-70)}`);
    } catch {
      logger.warn(`[FiltersPage] URL no cambió tras "${name}"`);
    }

    // Detectar muro de login
    if (await this._isLoginWall()) {
      logger.warn("[FiltersPage] Muro de login — volviendo atrás");
      await this.driver.navigate().back();
      await this._waitForResults().catch(() => {});
      return false;
    }

    try {
      await this._waitForResults();
      return true;
    } catch {
      return false;
    }
  }

  async _isLoginWall() {
    const url = await this.driver.getCurrentUrl();
    if (url.includes("/login") || url.includes("registration")) return true;
    try {
      await this.driver.findElement(
        By.xpath(
          '//*[contains(text(),"Para continuar, ingresa") or contains(text(),"Soy nuevo") or contains(text(),"Ya tengo cuenta")]',
        ),
      );
      return true;
    } catch {
      return false;
    }
  }

  async _waitForResults() {
    for (const loc of RESULTS_LOCATORS) {
      try {
        await this.driver.wait(until.elementLocated(loc), this.explicitWait);
        return;
      } catch {
        /* siguiente */
      }
    }
    throw new Error("Resultados no aparecieron tras el filtro");
  }

  async _sortViaSelect() {
    for (const sel of [
      "select.andes-form-control__field",
      ".ui-search-sort-filter select",
      "select",
    ]) {
      try {
        const select = await this.driver.findElement(By.css(sel));
        const val = await select.getAttribute("value");
        if (!val || val === "relevance") {
          logger.info("[FiltersPage] ✓ Sort: relevance (select)");
          return true;
        }
        const opts = await select.findElements(By.tagName("option"));
        for (const o of opts) {
          const t = await o.getText();
          if (SORT_TEXTS.some((x) => t.includes(x))) {
            await this._scrollIntoView(select);
            await o.click();
            logger.info(`[FiltersPage] ✓ Sort via <select>: "${t}"`);
            await this._waitForResults();
            return true;
          }
        }
      } catch {
        /* siguiente */
      }
    }
    return false;
  }

  async _sortViaDropdown() {
    for (const sel of [
      ".andes-dropdown__trigger",
      ".ui-search-sort-filter__title",
      '[class*="sort"] button',
    ]) {
      try {
        const trigger = await this.driver.findElement(By.css(sel));
        const txt = await trigger.getText();
        if (SORT_TEXTS.some((x) => txt.includes(x))) {
          logger.info("[FiltersPage] ✓ Sort: ya es relevante (dropdown)");
          return true;
        }
        await this._scrollIntoView(trigger);
        await trigger.click();
        await new Promise((r) => setTimeout(r, 600));
        const optXp = SORT_TEXTS.map(
          (t) => `//button[contains(normalize-space(),"${t}")]`,
        ).join(" | ");
        try {
          const opt = await this.driver.wait(
            until.elementLocated(By.xpath(optXp)),
            3000,
          );
          await opt.click();
          logger.info("[FiltersPage] ✓ Sort via dropdown");
          await this._waitForResults();
          return true;
        } catch {
          await this.driver.executeScript("document.body.click()");
        }
      } catch {
        /* siguiente */
      }
    }
    return false;
  }
}

module.exports = FiltersPage;
