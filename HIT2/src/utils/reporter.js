'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

/**
 * Genera un reporte de comparación entre resultados de dos browsers.
 *
 * @param {object} chromeResult  — resultado de scrape() para Chrome
 * @param {object} firefoxResult — resultado de scrape() para Firefox
 * @returns {{ json: string, html: string }} paths de los archivos generados
 */
function generateComparisonReport(chromeResult, firefoxResult) {
  const resultsDir = path.join(__dirname, '../../results');
  if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const comparison = buildComparison(chromeResult, firefoxResult);

  const jsonPath = path.join(resultsDir, `comparison-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(comparison, null, 2), 'utf-8');
  logger.info(`Comparison JSON: ${jsonPath}`);

  const htmlPath = path.join(resultsDir, `comparison-${timestamp}.html`);
  fs.writeFileSync(htmlPath, buildHtml(comparison), 'utf-8');
  logger.info(`Comparison HTML: ${htmlPath}`);

  return { json: jsonPath, html: htmlPath };
}

// ── Construcción del objeto de comparación ─────────────────────────────────

function buildComparison(chrome, firefox) {
  const chromeTitles = chrome.products.map((p) => p.title);
  const firefoxTitles = firefox.products.map((p) => p.title);

  const exactMatches = chromeTitles.filter((t) => firefoxTitles.includes(t));
  const onlyInChrome = chromeTitles.filter((t) => !firefoxTitles.includes(t));
  const onlyInFirefox = firefoxTitles.filter((t) => !chromeTitles.includes(t));

  const timeDiffMs = Math.abs(chrome.executionMs - firefox.executionMs);
  const fasterBrowser = chrome.executionMs <= firefox.executionMs ? 'chrome' : 'firefox';

  return {
    generatedAt: new Date().toISOString(),
    query: chrome.query,
    metrics: {
      chrome: { executionMs: chrome.executionMs, productCount: chrome.products.length },
      firefox: { executionMs: firefox.executionMs, productCount: firefox.products.length },
      timeDiffMs,
      fasterBrowser,
    },
    titleOverlap: {
      exactMatches,
      exactMatchCount: exactMatches.length,
      onlyInChrome,
      onlyInFirefox,
      overlapPct: Math.round(
        (exactMatches.length / Math.max(chromeTitles.length, firefoxTitles.length)) * 100
      ),
    },
    chrome: { products: chrome.products },
    firefox: { products: firefox.products },
  };
}

// ── HTML ───────────────────────────────────────────────────────────────────

function buildHtml(c) {
  const chromeRows = c.chrome.products.map((p) => productRow(p, c.firefox.products));
  const firefoxRows = c.firefox.products.map((p) => productRow(p, c.chrome.products, true));

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>HIT #2 — Comparación Chrome vs Firefox</title>
  <style>
    *  { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; padding: 2rem; color: #222; max-width: 1200px; margin: auto; }
    h1  { color: #333; }
    h2  { margin-top: 2rem; border-bottom: 2px solid #eee; padding-bottom: .4rem; }
    .metrics { display: flex; gap: 2rem; flex-wrap: wrap; margin: 1rem 0; }
    .metric-card { background: #f9f9f9; border: 1px solid #ddd; border-radius: 6px; padding: 1rem 1.5rem; min-width: 160px; }
    .metric-card .value { font-size: 1.8rem; font-weight: bold; color: #007bff; }
    .metric-card .label { font-size: .85rem; color: #666; margin-top: .2rem; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: .5rem .9rem; text-align: left; font-size: .9rem; }
    th { background: #f0f0f0; }
    tr.match  td { background: #e8f5e9; }
    tr.nomatch td { background: #fff3e0; }
    .badge { display: inline-block; border-radius: 12px; padding: .15rem .6rem; font-size: .75rem; font-weight: bold; }
    .badge-match { background: #c8e6c9; color: #2e7d32; }
    .badge-diff  { background: #ffe0b2; color: #e65100; }
    .summary-list { list-style: none; padding: 0; }
    .summary-list li { padding: .3rem 0; border-bottom: 1px solid #eee; }
  </style>
</head>
<body>
  <h1>HIT #2 — Comparación Chrome vs Firefox</h1>
  <p><strong>Query:</strong> "${c.query}" &nbsp;|&nbsp; <strong>Generado:</strong> ${c.generatedAt}</p>

  <h2>Métricas de ejecución</h2>
  <div class="metrics">
    <div class="metric-card">
      <div class="value">${c.metrics.chrome.executionMs}ms</div>
      <div class="label">Chrome — tiempo total</div>
    </div>
    <div class="metric-card">
      <div class="value">${c.metrics.firefox.executionMs}ms</div>
      <div class="label">Firefox — tiempo total</div>
    </div>
    <div class="metric-card">
      <div class="value">${c.metrics.timeDiffMs}ms</div>
      <div class="label">Diferencia &nbsp;(${c.metrics.fasterBrowser} más rápido)</div>
    </div>
    <div class="metric-card">
      <div class="value">${c.titleOverlap.overlapPct}%</div>
      <div class="label">Solapamiento de títulos</div>
    </div>
  </div>

  <h2>Análisis de diferencias</h2>
  <ul class="summary-list">
    <li>✅ Títulos en común: <strong>${c.titleOverlap.exactMatchCount}</strong></li>
    <li>🔵 Solo en Chrome: <strong>${c.titleOverlap.onlyInChrome.length}</strong>
      ${c.titleOverlap.onlyInChrome.map((t) => `<br>&nbsp;&nbsp;&nbsp;• ${t}`).join('')}
    </li>
    <li>🟠 Solo en Firefox: <strong>${c.titleOverlap.onlyInFirefox.length}</strong>
      ${c.titleOverlap.onlyInFirefox.map((t) => `<br>&nbsp;&nbsp;&nbsp;• ${t}`).join('')}
    </li>
  </ul>

  <h2>Resultados lado a lado</h2>
  <div class="grid">
    <div>
      <h3>Chrome</h3>
      <table>
        <thead><tr><th>#</th><th>Título</th><th>Precio</th><th>Match</th></tr></thead>
        <tbody>${chromeRows.join('')}</tbody>
      </table>
    </div>
    <div>
      <h3>Firefox</h3>
      <table>
        <thead><tr><th>#</th><th>Título</th><th>Precio</th><th>Match</th></tr></thead>
        <tbody>${firefoxRows.join('')}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

function productRow(product, otherProducts) {
  const matched = otherProducts.some((p) => p.title === product.title);
  const cls = matched ? 'match' : 'nomatch';
  const badge = matched
    ? '<span class="badge badge-match">mismo</span>'
    : '<span class="badge badge-diff">distinto</span>';
  return `<tr class="${cls}">
    <td>${product.position}</td>
    <td>${product.title}</td>
    <td>${product.price ?? 'N/A'}</td>
    <td>${badge}</td>
  </tr>`;
}

module.exports = { generateComparisonReport };
