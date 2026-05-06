#!/usr/bin/env node
"use strict";

/**
 * Navega a la página de resultados ya cargada y vuelca TODOS los links del sidebar.
 * Sirve para identificar los selectores reales de los filtros.
 */

const BrowserFactory = require("../utils/BrowserFactory");
const BrowserOptions = require("../utils/BrowserOptions");
const { By, until } = require("selenium-webdriver");

async function main() {
  const opts = new BrowserOptions({ browser: "chrome", headless: false });
  const driver = await BrowserFactory.create(opts);

  try {
    // Ir directo a la home y buscar
    await driver.get("https://www.mercadolibre.com.ar");
    const input = await driver.wait(
      until.elementLocated(By.css("input.nav-search-input")),
      20000,
    );
    await input.sendKeys("bicicleta rodado 29");
    await driver.findElement(By.css("button.nav-search-btn")).click();
    await driver.wait(
      until.elementLocated(By.css("li.ui-search-layout__item")),
      30000,
    );

    console.log(
      "\n[DIAGNOSIS] Results page loaded. Waiting 2s for filters to render...",
    );
    await new Promise((r) => setTimeout(r, 2000));

    // Dump de TODOS los <a> en el sidebar via JS
    const data = await driver.executeScript(`
      const results = [];

      // Buscar sidebar por distintas estrategias
      const candidates = [
        ...document.querySelectorAll('aside a'),
        ...document.querySelectorAll('[class*="sidebar"] a'),
        ...document.querySelectorAll('[class*="filter"] a'),
        ...document.querySelectorAll('[class*="ui-search-sidebar"] a'),
      ];

      // Deduplicar por elemento
      const seen = new Set();
      for (const a of candidates) {
        if (seen.has(a)) continue;
        seen.add(a);
        results.push({
          text: a.innerText.trim().replace(/\\s+/g,' ').slice(0,60),
          href: (a.href || '').replace('https://listado.mercadolibre.com.ar','').slice(0,120),
          classes: a.className.slice(0,80),
          parentClass: (a.parentElement?.className || '').slice(0,60),
        });
      }

      // También buscar elementos con texto "Nuevo", "Usado", "Sí", "No"
      const filterKeywords = ['Nuevo','Usado','Sí','Si','No'];
      for (const kw of filterKeywords) {
        const xpath = document.evaluate(
          \`//a[starts-with(normalize-space(),"\${kw}")]\`,
          document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null
        );
        for (let i = 0; i < xpath.snapshotLength; i++) {
          const el = xpath.snapshotItem(i);
          if (!seen.has(el)) {
            seen.add(el);
            results.push({
              text: el.innerText.trim().slice(0,60),
              href: (el.href || '').replace('https://listado.mercadolibre.com.ar','').slice(0,120),
              classes: el.className.slice(0,80),
              parentClass: (el.parentElement?.className || '').slice(0,60),
              keyword: kw,
            });
          }
        }
      }

      return {
        totalSidebarLinks: results.length,
        sidebarExists: !!document.querySelector('aside'),
        filterGroupExists: !!document.querySelector('[class*="filter-group"]'),
        links: results,
      };
    `);

    console.log("\n=== SIDEBAR LINKS ===");
    console.log(`Sidebar <aside> found: ${data.sidebarExists}`);
    console.log(`Filter group found: ${data.filterGroupExists}`);
    console.log(`Total links in sidebar: ${data.totalSidebarLinks}`);
    console.log("\n--- Links ---");
    for (const l of data.links) {
      console.log(`TEXT: "${l.text}" | HREF: ${l.href}`);
      console.log(`  class="${l.classes}" parentClass="${l.parentClass}"`);
      if (l.keyword) console.log(`  ** matched keyword: ${l.keyword}`);
      console.log("");
    }
  } finally {
    await driver.quit();
  }
}

main().catch(console.error);
