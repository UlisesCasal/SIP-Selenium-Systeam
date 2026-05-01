'use strict';

const ProductParser = require('../../src/parsers/ProductParser');

describe('ProductParser', () => {
  it('parsea precios ARS sin símbolos ni separadores', () => {
    expect(ProductParser.parsePrice('$ 1.234.567')).toBe(1234567);
    expect(ProductParser.parsePrice('1.999 pesos')).toBe(1999);
    expect(ProductParser.parsePrice('sin precio')).toBeNull();
  });

  it('detecta envío gratis', () => {
    expect(ProductParser.hasFreeShipping('Envío gratis')).toBe(true);
    expect(ProductParser.hasFreeShipping('Llega mañana')).toBe(false);
  });

  it('extrae cuotas sin interés', () => {
    expect(ProductParser.parseInterestFreeInstallments('Mismo precio en 6 cuotas de $ 100.000 sin interés')).toBe('6 cuotas de $ 100.000 sin interés');
    expect(ProductParser.parseInterestFreeInstallments('12 cuotas sin interés')).toBe('12 cuotas sin interés');
    expect(ProductParser.parseInterestFreeInstallments('Cuotas con interés')).toBeNull();
  });

  it('normaliza un resultado al contrato de salida', () => {
    const product = ProductParser.toOutputProduct({
      title: '  iPhone 16 Pro Max  ',
      priceText: '$ 4.999.999',
      link: 'https://articulo.mercadolibre.com.ar/MLA-123',
      rawText: 'Tienda oficial Apple Envío gratis 12 cuotas sin interés',
    });

    expect(product).toEqual({
      titulo: 'iPhone 16 Pro Max',
      precio: 4999999,
      link: 'https://articulo.mercadolibre.com.ar/MLA-123',
      tienda_oficial: 'Apple',
      envio_gratis: true,
      cuotas_sin_interes: '12 cuotas sin interés',
    });
  });
});
