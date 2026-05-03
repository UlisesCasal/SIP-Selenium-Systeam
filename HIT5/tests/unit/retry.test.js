"use strict";

const { retry, sleep } = require("../../src/utils/retry");

describe("retry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("sleep resuelve después del tiempo indicado", async () => {
    const promise = sleep(20);
    jest.advanceTimersByTime(20);
    await expect(promise).resolves.toBeUndefined();
  });

  it("reintenta con backoff y retorna el valor exitoso", async () => {
    const operation = jest
      .fn()
      .mockRejectedValueOnce(new Error("uno"))
      .mockResolvedValueOnce("ok");
    const logger = { warn: jest.fn() };

    const promise = retry(operation, {
      retries: 2,
      delayMs: 10,
      factor: 3,
      label: "test",
      logger,
    });
    await Promise.resolve();
    jest.advanceTimersByTime(10);

    await expect(promise).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(operation).toHaveBeenNthCalledWith(1, 0);
    expect(operation).toHaveBeenNthCalledWith(2, 1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Reintentando en 10ms"));
  });

  it("lanza el último error si agota reintentos", async () => {
    const operation = jest.fn().mockRejectedValue(new Error("final"));
    const promise = retry(operation, {
      retries: 1,
      delayMs: 5,
      logger: { warn: jest.fn() },
    });
    await Promise.resolve();
    jest.advanceTimersByTime(5);

    await expect(promise).rejects.toThrow("final");
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
