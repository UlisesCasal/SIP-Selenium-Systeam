'use strict';

const fs = require('fs');
const path = require('path');
const { slugifyProduct } = require('../config/products');
const { validateProducts } = require('../utils/schema');

class JsonWriter {
  constructor({ outputDir = 'output', logger = console } = {}) {
    this.outputDir = path.resolve(__dirname, '../../', outputDir);
    this.logger = logger;
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  write(productName, products) {
    const errors = validateProducts(products);
    if (errors.length > 0) {
      throw new Error(`Schema inválido para "${productName}": ${errors.join(' ')}`);
    }

    const filePath = path.join(this.outputDir, `${slugifyProduct(productName)}.json`);
    fs.writeFileSync(filePath, JSON.stringify(products, null, 2), 'utf8');
    this.logger.info(`[JsonWriter] ${products.length} productos guardados en ${filePath}`);
    return filePath;
  }

  writeStats(productName, stats) {
    this.logger.info(`[JsonWriter] Stats para "${productName}": min=$${stats.min}, max=$${stats.max}, median=$${stats.median}, stdDev=$${stats.stdDev.toFixed(2)}`);
  }
}

module.exports = JsonWriter;
