'use strict';

const FiltersPage = require('../../src/pages/FiltersPage');

describe('FiltersPage', () => {
  let mockDriver;
  let mockElement;

  beforeEach(() => {
    mockElement = {
      click: jest.fn().mockResolvedValue(),
    };
    mockDriver = {
      wait: jest.fn().mockResolvedValue(mockElement),
      executeScript: jest.fn().mockResolvedValue(),
      getCurrentUrl: jest.fn()
        .mockResolvedValueOnce('http://old')
        .mockResolvedValueOnce('http://new'),
      navigate: jest.fn().mockReturnValue({ back: jest.fn().mockResolvedValue() }),
      findElements: jest.fn().mockResolvedValue([]),
    };
  });

  it('applyAllFilters applies all filters and returns result', async () => {
    const page = new FiltersPage(mockDriver, 1000);
    jest.spyOn(page, '_safeApply').mockResolvedValue(true);

    const result = await page.applyAllFilters();
    expect(result).toEqual({ condicion: true, tiendaOficial: true, orden: true });
    expect(page._safeApply).toHaveBeenCalledTimes(3);
  });

  it('_safeApply returns true if successful', async () => {
    const page = new FiltersPage(mockDriver, 1000);
    const result = await page._safeApply('test', async () => true);
    expect(result).toBe(true);
  });

  it('_safeApply returns false if error', async () => {
    const page = new FiltersPage(mockDriver, 1000);
    const result = await page._safeApply('test', async () => { throw new Error('fail'); });
    expect(result).toBe(false);
  });

  it('_clickAndWait clicks and waits for url change', async () => {
    const page = new FiltersPage(mockDriver, 1000);
    const result = await page._clickAndWait(mockElement);
    expect(result).toBe(true);
    expect(mockElement.click).toHaveBeenCalled();
  });

  it('_clickAndWait returns false if login wall detected', async () => {
    mockDriver.getCurrentUrl = jest.fn().mockResolvedValue('http://login');
    const page = new FiltersPage(mockDriver, 1000);
    const result = await page._clickAndWait(mockElement);
    expect(result).toBe(false);
    expect(mockDriver.navigate().back).toHaveBeenCalled();
  });
});
