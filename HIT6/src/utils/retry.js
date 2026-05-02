'use strict';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry(operation, options = {}) {
  const retries = options.retries !== undefined ? options.retries : 3;
  const delayMs = options.delayMs !== undefined ? options.delayMs : 2000;
  const factor = options.factor !== undefined ? options.factor : 2;
  const label = options.label !== undefined ? options.label : 'operation';
  const logger = options.logger !== undefined ? options.logger : console;

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      const wait = delayMs * Math.pow(factor, attempt);
      logger.warn(
        `[retry] ${label} falló intento ${attempt + 1}/${retries + 1} ` +
        `(${error.message}). Reintentando en ${wait}ms`
      );
      await sleep(wait);
    }
  }
  throw lastError;
}

module.exports = { retry, sleep };
