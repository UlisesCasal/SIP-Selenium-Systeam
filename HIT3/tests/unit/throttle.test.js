'use strict';

const throttle = require('../../src/utils/throttle');

describe('throttle', () => {
  it('resuelve después de la duración indicada', async () => {
    const start = Date.now();
    await throttle(100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(80);
  });

  it('usa 1500ms como default', () => {
    const promise = throttle();
    expect(promise).toBeInstanceOf(Promise);
  });

  it('resuelve con undefined', async () => {
    const result = await throttle(10);
    expect(result).toBeUndefined();
  });
});
