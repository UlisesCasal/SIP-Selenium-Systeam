'use strict';

const BrowserFactory = require('../../src/utils/BrowserFactory');
const { Builder } = require('selenium-webdriver');

jest.mock('selenium-webdriver', () => {
  const mBuilder = {
    forBrowser: jest.fn().mockReturnThis(),
    setChromeOptions: jest.fn().mockReturnThis(),
    setFirefoxOptions: jest.fn().mockReturnThis(),
    build: jest.fn().mockResolvedValue('mock_driver'),
  };
  return { Builder: jest.fn(() => mBuilder) };
});

jest.mock('selenium-webdriver/chrome', () => {
  return { Options: jest.fn().mockImplementation(() => ({
    excludeSwitches: jest.fn(),
    addArguments: jest.fn(),
  }))};
});

jest.mock('selenium-webdriver/firefox', () => {
  return { Options: jest.fn().mockImplementation(() => ({
    addArguments: jest.fn(),
  }))};
});

describe('BrowserFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a chrome driver', async () => {
    const driver = await BrowserFactory.create('chrome', false);
    expect(driver).toBe('mock_driver');
  });

  it('creates a chrome headless driver', async () => {
    const driver = await BrowserFactory.create('chrome', true);
    expect(driver).toBe('mock_driver');
  });

  it('creates a firefox driver', async () => {
    const driver = await BrowserFactory.create('firefox', false);
    expect(driver).toBe('mock_driver');
  });

  it('creates a firefox headless driver', async () => {
    const driver = await BrowserFactory.create('firefox', true);
    expect(driver).toBe('mock_driver');
  });

  it('throws an error for unsupported browser', async () => {
    await expect(BrowserFactory.create('safari', false)).rejects.toThrow(/Browser 'safari' no soportado/);
  });
});
