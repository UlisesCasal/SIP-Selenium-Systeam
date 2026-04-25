/**
 * Espera `ms` milisegundos entre requests para no generar carga indebida
 * en el servidor. NO es un mecanismo de sincronización de UI; para eso
 * se usan explicit waits en los Page Objects.
 */
function throttle(ms = 1500) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = throttle;
