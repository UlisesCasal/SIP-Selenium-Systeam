'use strict';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry(operation, {
  retries = 2,
  delayMs = 1000,
  factor = 2,
  label = 'operation',
  logger = console,
} = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      const wait = delayMs * Math.pow(factor, attempt);
      logger.warn(`[retry] ${label} falló intento ${attempt + 1}/${retries + 1}: ${error.message}. Reintentando en ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastError;
}

module.exports = { retry, sleep };
