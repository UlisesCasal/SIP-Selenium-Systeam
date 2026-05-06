"use strict";

class ProductParser {
  static parsePrice(raw) {
    if (raw === null || raw === undefined) return null;
    const digits = String(raw).replace(/[^\d]/g, "");
    if (!digits) return null;
    return Number.parseInt(digits, 10);
  }

  static normalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  static parseOfficialStore(rawText) {
    const text = this.normalizeText(rawText);
    if (!text) return null;

    const officialMatch = text.match(
      /Tienda oficial\s+([^$]+?)(?:\s{2,}|$|Envío|Cuotas|Mismo precio)/i,
    );
    if (officialMatch && officialMatch[1])
      return this.normalizeText(officialMatch[1]);

    const sellerMatch = text.match(
      /Por\s+([^$]+?)(?:\s+Envío|\s+Cuotas|\s*$)/i,
    );
    return sellerMatch ? this.normalizeText(sellerMatch[1]) : null;
  }

  static hasFreeShipping(rawText) {
    return /env[ií]o\s+gratis/i.test(String(rawText || ""));
  }

  static parseInterestFreeInstallments(rawText) {
    const text = this.normalizeText(rawText);
    if (!/sin inter[eé]s/i.test(text)) return null;

    const patterns = [
      /(\d+\s+cuotas?\s+.{0,80}?sin inter[eé]s)/i,
      /(cuotas?\s+.{0,80}?sin inter[eé]s)/i,
      /(.{0,80}sin inter[eé]s.{0,40})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) return this.normalizeText(match[1]);
    }
    return null;
  }

  static toOutputProduct({
    title,
    priceText,
    link,
    rawText,
    officialStoreText,
  }) {
    const normalizedTitle = this.normalizeText(title);
    const normalizedRaw = this.normalizeText(rawText);

    return {
      titulo: normalizedTitle,
      precio: this.parsePrice(priceText) ?? 0,
      link,
      tienda_oficial: this.parseOfficialStore(
        officialStoreText || normalizedRaw,
      ),
      envio_gratis: this.hasFreeShipping(normalizedRaw),
      cuotas_sin_interes: this.parseInterestFreeInstallments(normalizedRaw),
    };
  }
}

module.exports = ProductParser;
