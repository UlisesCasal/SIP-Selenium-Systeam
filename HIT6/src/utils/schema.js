"use strict";

function isAbsoluteUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function validateProduct(product) {
  const errors = [];
  if (!product || typeof product !== "object" || Array.isArray(product)) {
    return ["El producto debe ser un objeto."];
  }
  if (typeof product.titulo !== "string" || product.titulo.trim() === "") {
    errors.push("titulo debe ser string no vacío.");
  }
  if (!Number.isInteger(product.precio) || product.precio < 0) {
    errors.push("precio debe ser número entero en ARS.");
  }
  if (typeof product.link !== "string" || !isAbsoluteUrl(product.link)) {
    errors.push("link debe ser URL absoluta.");
  }
  if (
    !(
      typeof product.tienda_oficial === "string" ||
      product.tienda_oficial === null
    )
  ) {
    errors.push("tienda_oficial debe ser string o null.");
  }
  if (typeof product.envio_gratis !== "boolean") {
    errors.push("envio_gratis debe ser boolean.");
  }
  if (
    !(
      typeof product.cuotas_sin_interes === "string" ||
      product.cuotas_sin_interes === null
    )
  ) {
    errors.push("cuotas_sin_interes debe ser string o null.");
  }
  return errors;
}

function validateProducts(products) {
  if (!Array.isArray(products)) return ["El JSON raíz debe ser un array."];
  return products.flatMap((product, index) =>
    validateProduct(product).map((error) => `Producto ${index}: ${error}`),
  );
}

module.exports = { validateProduct, validateProducts };
