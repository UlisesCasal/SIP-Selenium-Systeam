'use strict';

/**
 * Tests unitarios de BrowserOptions — no abren ningún browser.
 */

const BrowserOptions = require('../src/utils/BrowserOptions');

describe('BrowserOptions — constructor', () => {
  it('usa chrome y headless=false por defecto', () => {
    const opts = new BrowserOptions();
    expect(opts.browser).toBe('chrome');
    expect(opts.headless).toBe(false);
    expect(opts.windowWidth).toBe(1920);
    expect(opts.windowHeight).toBe(1080);
  });

  it('normaliza el nombre del browser a minúsculas', () => {
    expect(new BrowserOptions({ browser: 'Chrome' }).browser).toBe('chrome');
    expect(new BrowserOptions({ browser: 'FIREFOX' }).browser).toBe('firefox');
  });

  it('lanza error para browser no soportado', () => {
    expect(() => new BrowserOptions({ browser: 'safari' })).toThrow(
      /no soportado/i
    );
    expect(() => new BrowserOptions({ browser: 'edge' })).toThrow();
  });

  it('lanza error para dimensiones inválidas', () => {
    expect(() => new BrowserOptions({ windowWidth: 0 })).toThrow();
    expect(() => new BrowserOptions({ windowHeight: -1 })).toThrow();
  });

  it('convierte headless a booleano', () => {
    expect(new BrowserOptions({ headless: 1 }).headless).toBe(true);
    expect(new BrowserOptions({ headless: 0 }).headless).toBe(false);
    // Boolean('true') === true porque cualquier string no vacío es truthy
    expect(new BrowserOptions({ headless: 'true' }).headless).toBe(true);
    expect(new BrowserOptions({ headless: '' }).headless).toBe(false);
  });

  it('acepta opciones personalizadas', () => {
    const opts = new BrowserOptions({
      browser: 'firefox',
      headless: true,
      windowWidth: 1280,
      windowHeight: 720,
      pageLoadTimeout: 60000,
      explicitWait: 15000,
    });
    expect(opts.browser).toBe('firefox');
    expect(opts.headless).toBe(true);
    expect(opts.windowWidth).toBe(1280);
    expect(opts.pageLoadTimeout).toBe(60000);
    expect(opts.explicitWait).toBe(15000);
  });
});

describe('BrowserOptions — getSupportedBrowsers()', () => {
  it('retorna chrome y firefox', () => {
    const supported = BrowserOptions.getSupportedBrowsers();
    expect(supported).toContain('chrome');
    expect(supported).toContain('firefox');
    expect(supported.length).toBe(2);
  });

  it('retorna una copia — no permite mutación de la lista interna', () => {
    const a = BrowserOptions.getSupportedBrowsers();
    a.push('edge');
    const b = BrowserOptions.getSupportedBrowsers();
    expect(b).not.toContain('edge');
  });
});

describe('BrowserOptions — fromCli()', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    // process.env.X = undefined convierte a string "undefined"; hay que delete
    delete process.env.BROWSER;
    delete process.env.HEADLESS;
    process.argv = originalArgv;
  });

  it('usa el valor de BROWSER env var', () => {
    process.env.BROWSER = 'firefox';
    const opts = BrowserOptions.fromCli();
    expect(opts.browser).toBe('firefox');
  });

  it('usa el argumento CLI si BROWSER env no está definido', () => {
    delete process.env.BROWSER;
    process.argv = ['node', 'script.js', 'firefox'];
    const opts = BrowserOptions.fromCli();
    expect(opts.browser).toBe('firefox');
  });

  it('usa el default si no hay env ni arg', () => {
    delete process.env.BROWSER;
    process.argv = ['node', 'script.js'];
    const opts = BrowserOptions.fromCli('chrome');
    expect(opts.browser).toBe('chrome');
  });

  it('env var tiene precedencia sobre CLI arg', () => {
    process.env.BROWSER = 'firefox';
    process.argv = ['node', 'script.js', 'chrome'];
    const opts = BrowserOptions.fromCli();
    expect(opts.browser).toBe('firefox');
  });

  it('detecta --headless en argv', () => {
    delete process.env.BROWSER;
    delete process.env.HEADLESS;
    process.argv = ['node', 'script.js', 'chrome', '--headless'];
    const opts = BrowserOptions.fromCli();
    expect(opts.headless).toBe(true);
  });

  it('detecta HEADLESS=true en env', () => {
    process.env.HEADLESS = 'true';
    const opts = BrowserOptions.fromCli();
    expect(opts.headless).toBe(true);
    delete process.env.HEADLESS;
  });
});

describe('BrowserOptions — toString()', () => {
  it('incluye browser y headless', () => {
    const s = new BrowserOptions({ browser: 'firefox', headless: true }).toString();
    expect(s).toMatch(/firefox/);
    expect(s).toMatch(/headless=true/);
  });
});
