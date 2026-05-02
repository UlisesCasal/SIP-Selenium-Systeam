'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const JsonWriter = require('../../src/writers/JsonWriter');

describe('JsonWriter', () => {
  it('escribe un array validado con nombre slugificado', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hit4-writer-'));
    const writer = new JsonWriter({ outputDir: tmp, logger: { info: jest.fn() } });

    const file = writer.write('bicicleta rodado 29', [{
      titulo: 'Bicicleta',
      precio: 100,
      link: 'https://example.com/item',
      tienda_oficial: null,
      envio_gratis: false,
      cuotas_sin_interes: null,
    }]);

    expect(path.basename(file)).toBe('bicicleta_rodado_29.json');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))[0].precio).toBe(100);
  });

  it('falla antes de persistir si el schema es inválido', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hit4-writer-'));
    const writer = new JsonWriter({ outputDir: tmp, logger: { info: jest.fn() } });
    expect(() => writer.write('bad', [{ titulo: '' }])).toThrow(/Schema inválido/);
  });
});
