"use strict";

const DEFAULT_PRODUCTS = [
  "bicicleta rodado 29",
  "iPhone 16 Pro Max",
  "GeForce RTX 5090",
];

function slugifyProduct(product) {
  return product
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/iphone\s+16\s+pro\s+max/i, "iphone_16_pro_max")
    .replace(/geforce\s+rtx\s+5090/i, "geforce_5090")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseProducts(raw = process.env.PRODUCTS) {
  if (!raw) return [...DEFAULT_PRODUCTS];
  return raw
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

module.exports = { DEFAULT_PRODUCTS, parseProducts, slugifyProduct };
