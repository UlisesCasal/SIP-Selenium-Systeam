'use strict';

const { getFallbackProducts } = require('../../src/scrapers/fallback-data');

describe('fallback-data', () => {
  it('devuelve productos para "Bicicleta rodado 29"', () => {
    const products = getFallbackProducts('Bicicleta rodado 29', 5);
    expect(products.length).toBeGreaterThanOrEqual(1);
    expect(products.length).toBeLessThanOrEqual(5);
    products.forEach((p, i) => {
      expect(p.position).toBe(i + 1);
      expect(typeof p.title).toBe('string');
      expect(p.title.length).toBeGreaterThan(0);
    });
  });

  it('devuelve productos para "iPhone 16 Pro Max"', () => {
    const products = getFallbackProducts('iPhone 16 Pro Max', 3);
    expect(products.length).toBe(3);
  });

  it('devuelve productos para "GeForce RTX 5090"', () => {
    const products = getFallbackProducts('GeForce RTX 5090', 5);
    expect(products.length).toBe(1);
  });

  it('devuelve array vacío para query desconocida', () => {
    const products = getFallbackProducts('producto inexistente', 5);
    expect(products).toEqual([]);
  });

  it('respeta el límite cuando hay más productos disponibles', () => {
    const products = getFallbackProducts('Bicicleta rodado 29', 2);
    expect(products.length).toBe(2);
    expect(products[0].position).toBe(1);
    expect(products[1].position).toBe(2);
  });

  it('cada producto tiene url null en fallback', () => {
    const products = getFallbackProducts('Bicicleta rodado 29', 5);
    products.forEach((p) => {
      expect(p.url).toBeNull();
    });
  });
});
