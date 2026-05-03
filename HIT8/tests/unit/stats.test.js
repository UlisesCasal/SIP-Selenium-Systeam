'use strict';

const { calculateStats, formatPriceStats } = require('../../src/utils/stats');

describe('calculateStats', () => {
  test('debería calcular correctamente min, max, median, stdDev para 30 resultados', () => {
    const products = Array.from({ length: 30 }, (_, i) => ({ precio: 1000 + i * 100 }));
    const stats = calculateStats(products);
    expect(stats.min).toBe(1000);
    expect(stats.max).toBe(3900);
    expect(stats.median).toBe(2450);
    expect(stats.stdDev).toBeGreaterThan(0);
  });

  test('debería manejar productos sin precio', () => {
    const products = [{ precio: null }, { precio: undefined }, { titulo: 'Sin precio' }];
    const stats = calculateStats(products);
    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
    expect(stats.median).toBe(0);
  });

  test('debería calcular mediana correcta para cantidad par', () => {
    const products = [
      { precio: 100 },
      { precio: 200 },
      { precio: 300 },
      { precio: 400 },
    ];
    const stats = calculateStats(products);
    expect(stats.median).toBe(250);
  });
});

describe('formatPriceStats', () => {
  test('debería formatear correctamente las estadísticas', () => {
    const stats = { min: 1000, max: 5000, median: 3000, stdDev: 500.50 };
    const formatted = formatPriceStats(stats);
    expect(formatted).toContain('$1000');
    expect(formatted).toContain('$5000');
    expect(formatted).toContain('$3000');
    expect(formatted).toContain('$500.50');
  });
});
