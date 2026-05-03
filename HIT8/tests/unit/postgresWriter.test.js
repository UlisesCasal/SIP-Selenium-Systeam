'use strict';

const pg = require('pg');

jest.mock('pg', () => {
  const mockPool = {
    query: jest.fn(),
    end: jest.fn(),
    options: {},
  };
  return { Pool: jest.fn((opts) => { mockPool.options = opts; return mockPool; }) };
});

const PostgresWriter = require('../../src/writers/PostgresWriter');

describe('PostgresWriter', () => {
  let writer;
  let pool;

  beforeEach(() => {
    jest.clearAllMocks();
    writer = new PostgresWriter({
      host: 'localhost',
      port: 5432,
      user: 'test',
      password: 'test',
      database: 'test',
    });
    pool = writer.pool;
  });

  test('debería conectar a PostgreSQL', async () => {
    pool.query.mockResolvedValueOnce();
    await writer.connect();
    expect(writer._connected).toBe(true);
  });

  test('debería ejecutar migraciones al conectar', async () => {
    pool.query.mockResolvedValueOnce();
    const fs = require('fs');
    const mockReadDir = jest.spyOn(fs, 'readdirSync').mockReturnValue(['001_test.sql']);
    const mockReadFile = jest.spyOn(fs, 'readFileSync').mockReturnValue('CREATE TABLE test;');
    const mockExists = jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    await writer.connect();

    expect(pool.query).toHaveBeenCalledWith('CREATE TABLE test;');
    mockReadDir.mockRestore();
    mockReadFile.mockRestore();
    mockExists.mockRestore();
  });

  test('debería escribir productos en PostgreSQL', async () => {
    pool.query.mockResolvedValueOnce();
    await writer.connect();
    pool.query.mockClear();
    pool.query.mockResolvedValueOnce();

    const products = [
      { titulo: 'Producto 1', precio: 1000, link: 'http://test', tienda_oficial: true, envio_gratis: false, cuotas_sin_interes: true },
    ];

    await writer.write('test', products);
    expect(pool.query).toHaveBeenCalled();
  });
});
