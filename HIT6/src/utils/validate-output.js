#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { DEFAULT_PRODUCTS, slugifyProduct } = require('../config/products');
const { validateProducts } = require('./schema');

const outputDir = path.resolve(__dirname, '../../', process.env.OUTPUT_DIR || 'output');
let failed = false;

for (const product of DEFAULT_PRODUCTS) {
  const file = path.join(outputDir, `${slugifyProduct(product)}.json`);
  if (!fs.existsSync(file)) {
    console.error(`No existe: ${file}`);
    failed = true;
    continue;
  }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const errors = validateProducts(data);
  if (errors.length > 0) {
    console.error(`${file} inválido:\n${errors.join('\n')}`);
    failed = true;
  } else {
    console.log(`${file} OK (${data.length} productos)`);
  }
}

process.exit(failed ? 1 : 0);
