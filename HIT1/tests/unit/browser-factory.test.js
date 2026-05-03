'use strict';

// Mock selenium-webdriver para no necesitar browser real
jest.mock('selenium-webdriver', () => ({
  Builder: jest.fn(),
  By: { css: jest.fn((s) => ({ toString: () => `By(css selector, ${s})` })) },
  Key: { ENTER: '\uE007' },
  until: {
    elementLocated: jest.fn(),
    elementIsVisible: jest.fn(),
  },
}));
jest.mock('selenium-webdriver/chrome', () => ({
  Options: jest.fn().mockImplementation(() => ({
    setPageLoadStrategy: jest.fn().mockReturnThis(),
    excludeSwitches: jest.fn().mockReturnThis(),
    addArguments: jest.fn().mockReturnThis(),
  })),
}));
jest.mock('selenium-webdriver/firefox', () => ({
  Options: jest.fn().mockImplementation(() => ({
    setPageLoadStrategy: jest.fn().mockReturnThis(),
    addArguments: jest.fn().mockReturnThis(),
  })),
}));

const { Builder } = require('selenium-webdriver');

describe('BrowserFactory', () => {
  let BrowserFactory;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // Re-mock after resetModules
    jest.mock('selenium-webdriver', () => ({
      Builder: jest.fn(),
      By: { css: jest.fn((s) => ({ toString: () => `By(css selector, ${s})` })) },
      Key: { ENTER: '\uE007' },
      until: {
        elementLocated: jest.fn(),
        elementIsVisible: jest.fn(),
      },
    }));
    jest.mock('selenium-webdriver/chrome', () => ({
      Options: jest.fn().mockImplementation(() => ({
        setPageLoadStrategy: jest.fn().mockReturnThis(),
        excludeSwitches: jest.fn().mockReturnThis(),
        addArguments: jest.fn().mockReturnThis(),
      })),
    }));
    jest.mock('selenium-webdriver/firefox', () => ({
      Options: jest.fn().mockImplementation(() => ({
        setPageLoadStrategy: jest.fn().mockReturnThis(),
        addArguments: jest.fn().mockReturnThis(),
      })),
    }));

    const mockDriver = {
      manage: jest.fn().mockReturnValue({
        setTimeouts: jest.fn().mockResolvedValue(undefined),
      }),
      sendDevToolsCommand: jest.fn().mockResolvedValue(undefined),
    };

    const mockBuilder = {
      forBrowser: jest.fn().mockReturnThis(),
      setChromeOptions: jest.fn().mockReturnThis(),
      setFirefoxOptions: jest.fn().mockReturnThis(),
      build: jest.fn().mockResolvedValue(mockDriver),
    };

    require('selenium-webdriver').Builder.mockImplementation(() => mockBuilder);

    BrowserFactory = require('../../src/utils/BrowserFactory');
  });

  it('crea un driver chrome por defecto', async () => {
    const driver = await BrowserFactory.create('chrome', false);
    expect(driver).toBeDefined();
    expect(driver.manage).toBeDefined();
  });

  it('crea un driver chrome headless', async () => {
    const driver = await BrowserFactory.create('chrome', true);
    expect(driver).toBeDefined();
  });

  it('crea un driver firefox', async () => {
    const driver = await BrowserFactory.create('firefox', false);
    expect(driver).toBeDefined();
  });

  it('crea un driver firefox headless', async () => {
    const driver = await BrowserFactory.create('firefox', true);
    expect(driver).toBeDefined();
  });

  it('lanza error para browser no soportado', async () => {
    await expect(BrowserFactory.create('safari', false)).rejects.toThrow(
      /no soportado/
    );
  });

  it('usa chrome como default cuando no se pasa argumento', async () => {
    const driver = await BrowserFactory.create();
    expect(driver).toBeDefined();
  });
});
