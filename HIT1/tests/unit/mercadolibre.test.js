'use strict';

const fs = require('fs');
const path = require('path');
const { saveResults, generateHtmlReport } = require('../../src/scrapers/mercadolibre');

const RESULTS_DIR = path.join(__dirname, '../../results');

// Datos de prueba simulando resultados del scraper
const MOCK_RESULTS = [
  {
    query: 'Bicicleta rodado 29',
    browser: 'chrome',
    headless: true,
    executionMs: 5000,
    timestamp: '2026-01-01T00:00:00.000Z',
    screenshot: null,
    products: [
      { position: 1, title: 'Bicicleta MTB Rodado 29', price: '$300.000', url: 'https://mercadolibre.com.ar/1' },
      { position: 2, title: 'Bicicleta Mountain Bike 29', price: '$250.000', url: 'https://mercadolibre.com.ar/2' },
    ],
  },
  {
    query: 'iPhone 16 Pro Max',
    browser: 'chrome',
    headless: true,
    executionMs: 4500,
    timestamp: '2026-01-01T00:00:05.000Z',
    screenshot: null,
    products: [
      { position: 1, title: 'Apple iPhone 16 Pro Max 256GB', price: '$2.700.000', url: null },
    ],
  },
  {
    query: 'GeForce RTX 5090',
    browser: 'chrome',
    headless: true,
    executionMs: 3800,
    timestamp: '2026-01-01T00:00:10.000Z',
    screenshot: null,
    products: [
      { position: 1, title: 'MSI GeForce RTX 5090', price: null, url: null },
    ],
  },
];

describe('saveResults', () => {
  afterEach(() => {
    // Limpiar archivos generados por saveResults
    if (fs.existsSync(RESULTS_DIR)) {
      const files = fs.readdirSync(RESULTS_DIR);
      for (const file of files) {
        if (file.startsWith('results-test-') || file.startsWith('report-test-')) {
          fs.unlinkSync(path.join(RESULTS_DIR, file));
        }
      }
    }
  });

  it('genera archivos JSON y HTML', () => {
    const { jsonPath, htmlPath } = saveResults(MOCK_RESULTS, 'test-unit');
    expect(fs.existsSync(jsonPath)).toBe(true);
    expect(fs.existsSync(htmlPath)).toBe(true);

    // Limpiar
    fs.unlinkSync(jsonPath);
    fs.unlinkSync(htmlPath);
  });

  it('el JSON contiene los datos correctos', () => {
    const { jsonPath, htmlPath } = saveResults(MOCK_RESULTS, 'test-json');
    const content = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    expect(content).toEqual(MOCK_RESULTS);
    expect(content.length).toBe(3);
    expect(content[0].query).toBe('Bicicleta rodado 29');

    fs.unlinkSync(jsonPath);
    fs.unlinkSync(htmlPath);
  });

  it('el HTML contiene los títulos de los productos', () => {
    const { jsonPath, htmlPath } = saveResults(MOCK_RESULTS, 'test-html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    expect(html).toContain('Bicicleta MTB Rodado 29');
    expect(html).toContain('Apple iPhone 16 Pro Max 256GB');
    expect(html).toContain('MSI GeForce RTX 5090');

    fs.unlinkSync(jsonPath);
    fs.unlinkSync(htmlPath);
  });
});

describe('generateHtmlReport', () => {
  it('genera HTML válido con estructura de tabla', () => {
    const html = generateHtmlReport(MOCK_RESULTS, 'chrome');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<table>');
    expect(html).toContain('</table>');
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');
  });

  it('incluye el nombre del browser', () => {
    const html = generateHtmlReport(MOCK_RESULTS, 'firefox');
    expect(html).toContain('<strong>firefox</strong>');
  });

  it('genera una fila por cada producto', () => {
    const html = generateHtmlReport(MOCK_RESULTS, 'chrome');
    // 2 + 1 + 1 = 4 productos en total
    const trCount = (html.match(/<tr>/g) || []).length;
    // 1 fila de thead + 4 de datos = 5
    expect(trCount).toBe(5);
  });

  it('muestra N/A cuando el precio es null', () => {
    const html = generateHtmlReport(MOCK_RESULTS, 'chrome');
    expect(html).toContain('N/A');
  });

  it('muestra el tiempo de ejecución en ms', () => {
    const html = generateHtmlReport(MOCK_RESULTS, 'chrome');
    expect(html).toContain('5000ms');
    expect(html).toContain('4500ms');
    expect(html).toContain('3800ms');
  });
});
