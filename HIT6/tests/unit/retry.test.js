"use strict";

jest.mock("selenium-webdriver", () => {
  const original = jest.requireActual("selenium-webdriver");
  return {
    ...original,
    error: {
      TimeoutException: class TimeoutException extends Error {
        constructor(message) {
          super(message);
          this.name = "TimeoutException";
        }
      },
    },
  };
});

const { retry } = require("../../src/utils/retry");
const { error } = require("selenium-webdriver");

describe("retry", () => {
  it("dispara 3 veces ante TimeoutException y luego falla", async () => {
    const mockFn = jest.fn().mockImplementation(() => {
      throw new error.TimeoutException("timeout error");
    });

    await expect(
      retry(mockFn, { retries: 3, delayMs: 10, logger: { warn: jest.fn() } }),
    ).rejects.toThrow("timeout error");

    expect(mockFn).toHaveBeenCalledTimes(4);
  });

  it("tiene éxito en el segundo intento tras un TimeoutException", async () => {
    const mockFn = jest
      .fn()
      .mockImplementationOnce(() => {
        throw new error.TimeoutException("timeout");
      })
      .mockImplementationOnce(() => "success");

    const result = await retry(mockFn, {
      retries: 3,
      delayMs: 10,
      logger: { warn: jest.fn() },
    });
    expect(result).toBe("success");
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("falla inmediatamente si no hay reintentos", async () => {
    const mockFn = jest.fn().mockImplementation(() => {
      throw new error.TimeoutException("timeout");
    });

    await expect(
      retry(mockFn, { retries: 0, delayMs: 10, logger: { warn: jest.fn() } }),
    ).rejects.toThrow("timeout");

    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
