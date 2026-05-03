'use strict';

const { retry, sleep } = require('../../src/utils/retry');

describe('retry', () => {
  it('sleep espera la cantidad de ms', async () => {
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(40);
  });

  it('retorna el resultado de la operación si tiene éxito en el primer intento', async () => {
    const op = jest.fn().mockResolvedValue('success');
    const result = await retry(op);
    expect(result).toBe('success');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('reintenta si falla y tiene éxito luego', async () => {
    const op = jest.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockResolvedValueOnce('success 2');
    
    const loggerMock = { warn: jest.fn() };

    const result = await retry(op, { retries: 2, delayMs: 10, logger: loggerMock });
    expect(result).toBe('success 2');
    expect(op).toHaveBeenCalledTimes(2);
    expect(loggerMock.warn).toHaveBeenCalledTimes(1);
  });

  it('agota los reintentos y lanza el último error', async () => {
    const op = jest.fn().mockRejectedValue(new Error('always fail'));
    const loggerMock = { warn: jest.fn() };

    await expect(retry(op, { retries: 2, delayMs: 10, logger: loggerMock })).rejects.toThrow('always fail');
    expect(op).toHaveBeenCalledTimes(3);
  });
});
