"use strict";

const { getFallbackProducts } = require("../../src/scrapers/fallback-data");
const throttle = require("../../src/utils/throttle");

describe("fallback-data", () => {
  it("devuelve productos cacheados con posiciones consecutivas", () => {
    const products = getFallbackProducts("Bicicleta rodado 29", 2);

    expect(products).toHaveLength(2);
    expect(products[0]).toMatchObject({
      position: 1,
      title: expect.any(String),
      price: expect.any(String),
      url: null,
    });
    expect(products[1].position).toBe(2);
  });

  it("devuelve array vacío para queries sin cache", () => {
    expect(getFallbackProducts("producto inexistente")).toEqual([]);
  });
});

describe("throttle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resuelve después del tiempo solicitado", async () => {
    const promise = throttle(25);

    jest.advanceTimersByTime(25);

    await expect(promise).resolves.toBeUndefined();
  });
});
