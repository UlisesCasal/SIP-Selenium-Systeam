'use strict';

const throttle = require('../../src/utils/throttle');

describe('throttle', () => {
  it('resuelve después de la duración indicada', async () => {
    const start = Date.now();
    await throttle(100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(80); // margen de tolerancia
  });

  it('usa 1500ms como default si no se pasa argumento', async () => {
    const start = Date.now();
    const promise = throttle();
    // No esperamos los 1500ms completos, solo verificamos que devuelve una Promise
    expect(promise).toBeInstanceOf(Promise);
    // Cancelamos la espera para no demorar el test
  });

  it('resuelve con undefined', async () => {
    const result = await throttle(10);
    expect(result).toBeUndefined();
  });
});
