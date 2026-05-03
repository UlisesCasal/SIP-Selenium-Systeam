"use strict";

const { getFallbackProducts } = require("../../src/scrapers/fallback-data");

describe("getFallbackProducts", () => {
  it('devuelve productos para "bicicleta rodado 29"', () => {
    const result = getFallbackProducts("bicicleta rodado 29", 10);
    expect(result.length).toBe(10);
    result.forEach((p) => {
      expect(typeof p.titulo).toBe("string");
      expect(p.titulo.length).toBeGreaterThan(0);
      expect(typeof p.precio).toBe("number");
      expect(p.precio).toBeGreaterThan(0);
      expect(p.link).toMatch(/^https?:\/\//);
      expect(typeof p.envio_gratis).toBe("boolean");
    });
  });

  it('devuelve productos para "iPhone 16 Pro Max" (case-insensitive)', () => {
    const result = getFallbackProducts("iPhone 16 Pro Max", 10);
    expect(result.length).toBe(10);
  });

  it('devuelve productos para "GeForce RTX 5090" (case-insensitive)', () => {
    const result = getFallbackProducts("GeForce RTX 5090", 10);
    expect(result.length).toBe(10);
  });

  it("respeta el límite", () => {
    const result = getFallbackProducts("bicicleta rodado 29", 3);
    expect(result.length).toBe(3);
  });

  it("devuelve array vacío para query desconocida", () => {
    const result = getFallbackProducts("producto inexistente", 10);
    expect(result).toEqual([]);
  });
});
