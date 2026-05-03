'use strict';

function calculateStats(products) {
  const prices = products
    .map(p => p.precio)
    .filter(p => typeof p === 'number' && !isNaN(p))
    .sort((a, b) => a - b);

  if (prices.length === 0) {
    return { min: 0, max: 0, median: 0, stdDev: 0 };
  }

  const min = prices[0];
  const max = prices[prices.length - 1];
  const median = prices.length % 2 === 0
    ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
    : prices[Math.floor(prices.length / 2)];

  const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
  const stdDev = Math.sqrt(variance);

  return { min, max, median, stdDev };
}

function formatPriceStats(stats) {
  return `  Mínimo     : $${stats.min}\n  Máximo     : $${stats.max}\n  Mediana    : $${stats.median}\n  Desvío Std : $${stats.stdDev.toFixed(2)}`;
}

module.exports = { calculateStats, formatPriceStats };
