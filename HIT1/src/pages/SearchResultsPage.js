const { until } = require("selenium-webdriver");
const fs = require("fs");
const path = require("path");
const logger = require("../utils/logger");

const WAIT_MS = 30000;

// Directorio raíz de HIT1 — relativo a este archivo para evitar
// problemas de permisos cuando process.cwd() no es writable.
const HIT1_ROOT = path.resolve(__dirname, "../..");

/**
 * Page Object — Página de resultados de búsqueda de MercadoLibre.
 */
class SearchResultsPage {
  constructor(driver) {
    this.driver = driver;
  }

  async waitForResults() {
    logger.info("Waiting for search results...");

    // 1. Esperar a que el documento termine de cargar
    await this.driver
      .wait(
        () =>
          this.driver.executeScript(() => document.readyState === "complete"),
        WAIT_MS,
      )
      .catch(() => {});

    // 2. Esperar a que aparezcan ítems de producto con título válido
    //    (JS directo — no depende de visibilidad)
    const found = await this.driver
      .wait(async () => {
        return this.driver.executeScript(() => {
          const itemSelectors = [
            "li.ui-search-layout__item",
            ".poly-card",
            ".ui-search-result__wrapper",
            '[class*="ui-search-result"]',
          ];
          const titleSelectors = [
            ".poly-component__title",
            ".ui-search-item__title",
            "h2",
            "a[title]",
          ];
          for (const sel of itemSelectors) {
            const items = Array.from(document.querySelectorAll(sel));
            // Aceptamos si al menos 1 ítem tiene título — algunos searches devuelven pocos resultados
            const withTitle = items.filter((it) =>
              titleSelectors.some((t) => it.querySelector(t)),
            );
            if (withTitle.length >= 1) return true;
          }
          return false;
        });
      }, WAIT_MS)
      .catch(() => false);

    if (!found) {
      logger.error(
        "Timeout esperando resultados. Tomando screenshot para debug visual...",
      );
      try {
        const currentUrl = await this.driver.getCurrentUrl();
        const pageTitle = await this.driver.getTitle();
        logger.error(`URL actual: ${currentUrl}`);
        logger.error(`Título de página: ${pageTitle}`);

        // Loguear cuántos elementos encontró con cada selector para diagnóstico
        const counts = await this.driver.executeScript(() => {
          const sels = [
            "li.ui-search-layout__item",
            ".poly-card",
            ".ui-search-result__wrapper",
            'ol[class*="search"] li',
            'ul[class*="layout"] li',
            '[class*="search-results"] li',
            '[class*="ui-search"] li',
            "li",
            'a[href*="mercadolibre"]',
          ];
          return sels
            .map((s) => `${s}: ${document.querySelectorAll(s).length}`)
            .join(" | ");
        });
        logger.error(`Conteo de selectores: ${counts}`);

        const screenshot = await this.driver.takeScreenshot();
        const outputDir = path.join(HIT1_ROOT, "output");
        if (!fs.existsSync(outputDir))
          fs.mkdirSync(outputDir, { recursive: true });
        const filePath = path.join(outputDir, "error-resultados-captura.png");
        fs.writeFileSync(filePath, screenshot, "base64");
        logger.info(`Screenshot guardado en: ${filePath}`);
      } catch (err) {
        logger.error("No se pudo tomar el screenshot de debug: " + err.message);
      }
      throw new Error("No se encontró ningún resultado en la página");
    }

    logger.info("Search results are visible");
  }

  /**
   * Extrae los primeros `limit` productos usando executeScript para máxima
   * compatibilidad en headless (getText() puede devolver vacío si el elemento
   * no está en el viewport; textContent siempre funciona).
   * @param {number} limit
   * @returns {Promise<Array<{position: number, title: string, price: string|null, url: string|null}>>}
   */
  async getProducts(limit = 5) {
    const products = await this.driver.executeScript((maxItems) => {
      const itemSelectors = [
        "li.ui-search-layout__item",
        ".poly-card",
        ".ui-search-result__wrapper",
        '[class*="ui-search-result"]',
      ];

      const titleSelectors = [
        ".poly-component__title",
        ".ui-search-item__title",
        "h2",
        "a[title]",
      ];

      // Para cada selector de contenedor, quedarnos con el primero que devuelva
      // ítems CON título válido (filtra recommendations / suggested searches).
      let items = [];
      for (const sel of itemSelectors) {
        const found = Array.from(document.querySelectorAll(sel));
        const valid = found.filter((it) =>
          titleSelectors.some((t) => it.querySelector(t)),
        );
        if (valid.length > 0) {
          items = valid;
          break;
        }
      }

      const priceSelectors = [
        ".poly-price__current .andes-money-amount__fraction",
        ".andes-money-amount__fraction",
        ".price-tag-fraction",
        '[class*="price"] [class*="fraction"]',
        '[class*="amount"] [class*="fraction"]',
      ];

      function extractText(item, sels) {
        for (const s of sels) {
          const el = item.querySelector(s);
          if (el) {
            const text = (
              el.getAttribute("title") ||
              el.textContent ||
              ""
            ).trim();
            if (text) return text;
          }
        }
        return null;
      }

      const results = [];
      for (let i = 0; i < Math.min(maxItems, items.length); i++) {
        const item = items[i];
        const title = extractText(item, titleSelectors);
        if (!title) continue;
        const priceRaw = extractText(item, priceSelectors);
        const linkEl =
          item.querySelector('a[href*="mercadolibre"]') ||
          item.querySelector("a[href]");
        results.push({
          position: results.length + 1,
          title,
          price: priceRaw ? "$" + priceRaw : null,
          url: linkEl ? linkEl.href : null,
        });
      }
      return results;
    }, limit);

    if (products.length === 0) {
      logger.warn("No product items found on page");
    } else {
      products.forEach((p) =>
        logger.info(`[${p.position}] ${p.title} | Precio: ${p.price ?? "N/A"}`),
      );
    }

    return products;
  }

  /**
   * Toma un screenshot y lo guarda en /screenshots.
   * @param {string} name - nombre base del archivo
   */
  async takeScreenshot(name) {
    const screenshotsDir = path.join(HIT1_ROOT, "screenshots");
    if (!fs.existsSync(screenshotsDir))
      fs.mkdirSync(screenshotsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = path.join(screenshotsDir, `${name}-${timestamp}.png`);

    const data = await this.driver.takeScreenshot();
    fs.writeFileSync(filePath, data, "base64");
    logger.info(`Screenshot saved: ${filePath}`);
    return filePath;
  }
}

module.exports = SearchResultsPage;
