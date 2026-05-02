'use strict';

const { validateProduct, validateProducts } = require('../../src/utils/schema');

const valid = {
  titulo: 'Bicicleta Rodado 29',
  precio: 250000,
  link: 'https://articulo.mercadolibre.com.ar/MLA-123',
  tienda_oficial: null,
  envio_gratis: true,
  cuotas_sin_interes: '6 cuotas sin interés',
};

describe('schema JSON', () => {
  it('acepta productos válidos', () => {
    expect(validateProduct(valid)).toEqual([]);
    expect(validateProducts([valid])).toEqual([]);
  });

  it('rechaza campos fuera de contrato', () => {
    const errors = validateProduct({ ...valid, precio: '$250.000', link: '/relative' });
    expect(errors).toEqual(expect.arrayContaining([
      'precio debe ser número entero en ARS.',
      'link debe ser URL absoluta.',
    ]));
  });
});
