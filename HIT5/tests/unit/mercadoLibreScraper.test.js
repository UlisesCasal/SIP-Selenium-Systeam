'use strict';

const MercadoLibreScraper = require('../../src/scrapers/MercadoLibreScraper');
const ScraperConfig = require('../../src/config/ScraperConfig');

// Mocks
jest.mock('../../src/pages/HomePage');
jest.mock('../../src/pages/FiltersPage');
jest.mock('../../src/pages/SearchResultsPage');

describe('MercadoLibreScraper', () => {
  let mockDriver;
  let mockBrowserFactory;
  let mockWriter;
  let config;

  beforeEach(() => {
    mockDriver = {
      quit: jest.fn().mockResolvedValue(),
      get: jest.fn().mockResolvedValue(),
    };
    mockBrowserFactory = {
      create: jest.fn().mockResolvedValue(mockDriver),
    };
    mockWriter = {
      write: jest.fn().mockReturnValue('path/to/file.json'),
    };
    config = new ScraperConfig({
      products: ['bicicleta'],
      applyFilters: true,
      maxRetries: 0,
      explicitWait: 100,
    });
  });

  it('run executes the scraping flow and returns summary', async () => {
    const HomePage = require('../../src/pages/HomePage');
    const FiltersPage = require('../../src/pages/FiltersPage');
    const SearchResultsPage = require('../../src/pages/SearchResultsPage');

    HomePage.mockImplementation(() => ({
      open: jest.fn().mockResolvedValue(),
      search: jest.fn().mockResolvedValue(),
    }));

    FiltersPage.mockImplementation(() => ({
      applyAllFilters: jest.fn().mockResolvedValue({ condicion: true, tiendaOficial: true, orden: true }),
    }));

    SearchResultsPage.mockImplementation(() => ({
      waitForResults: jest.fn().mockResolvedValue(),
      getProducts: jest.fn().mockResolvedValue([
        { titulo: 'Bici', precio: '$1000' }
      ]),
    }));

    const scraper = new MercadoLibreScraper(config, {
      browserFactory: mockBrowserFactory,
      writer: mockWriter,
    });

    const summary = await scraper.run();
    expect(summary.length).toBe(1);
    expect(summary[0].query).toBe('bicicleta');
    expect(summary[0].products.length).toBe(1);
    expect(mockWriter.write).toHaveBeenCalled();
    expect(mockDriver.quit).toHaveBeenCalled();
  });

  it('scrapeProduct throws error if no products extracted', async () => {
    const SearchResultsPage = require('../../src/pages/SearchResultsPage');
    SearchResultsPage.mockImplementation(() => ({
      waitForResults: jest.fn().mockResolvedValue(),
      getProducts: jest.fn().mockResolvedValue([]),
    }));

    const scraper = new MercadoLibreScraper(config, {
      browserFactory: mockBrowserFactory,
      writer: mockWriter,
    });

    await expect(scraper.scrapeProduct(mockDriver, 'bicicleta')).rejects.toThrow('No se extrajeron productos');
  });

  it('_waitForResultsOrDirectSearch uses fallback URL on timeout', async () => {
    const scraper = new MercadoLibreScraper(config, { browserFactory: mockBrowserFactory, writer: mockWriter });
    const mockResultsPage = {
      waitForResults: jest.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce(),
    };

    await scraper._waitForResultsOrDirectSearch(mockDriver, mockResultsPage, 'bicicleta rodado');
    expect(mockDriver.get).toHaveBeenCalledWith(expect.stringContaining('bicicleta-rodado'));
    expect(mockResultsPage.waitForResults).toHaveBeenCalledTimes(2);
  });
});
