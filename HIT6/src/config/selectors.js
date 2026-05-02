'use strict';

const { By } = require('selenium-webdriver');

module.exports = {
  home: {
    searchInput: [
      By.css('input.nav-search-input'),
      By.css('input[name="as_word"]'),
      By.css('#cb1-edit'),
    ],
    searchButton: [
      By.css('button.nav-search-btn'),
      By.css('form.nav-search-form button[type="submit"]'),
      By.css('button[type="submit"]'),
    ],
  },

  results: {
    item: [
      By.css('li.ui-search-layout__item'),
      By.css('.ui-search-results .ui-search-layout__item'),
      By.css('.poly-card'),
      By.css('[data-testid="result-card"]'),
    ],
    title: [
      By.css('a.poly-component__title'),
      By.css('.poly-component__title'),
      By.css('.ui-search-item__title'),
      By.css('h2'),
      By.css('[data-testid="product-title"]'),
    ],
    price: [
      By.css('.poly-price__current .andes-money-amount__fraction'),
      By.css('.andes-money-amount__fraction'),
      By.css('.price-tag-fraction'),
      By.css('[aria-label*="pesos"]'),
    ],
    officialStore: [
      By.css('.ui-search-official-store-label'),
      By.css('.poly-component__seller'),
      By.css('[class*="official-store"]'),
      By.css('[class*="seller"]'),
    ],
    link: [
      By.css('a.poly-component__title'),
      By.css('a.ui-search-link'),
      By.css('a[href*="/"]'),
      By.css('a'),
    ],
    freeShipping: [
      By.xpath('.//span[contains(translate(text(), "ENVÍO GRATIS", "envío gratis"), "envío gratis")]'),
      By.css('.ui-pb-highlight')
    ],
    installments: [
      By.xpath('.//span[contains(translate(text(), "CUOTAS", "cuotas"), "cuotas")]'),
      By.css('.ui-search-installments')
    ],
  },

  filters: {
    conditionNew: By.xpath('//*[@id="root-app"]//span[text()="Nuevo"]'),
    officialStores: By.xpath('//*[@id="root-app"]//span[text()="Tiendas oficiales"]'),
    sortBy: By.xpath('//*[@id="root-app"]//span[text()="Más relevantes"]'),
    sortOption: By.xpath('//*[@id="root-app"]//span[text()="Más vendidos"]'),
  },
};