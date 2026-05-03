'use strict';

const { Pool } = require('pg');
const logger = require('../utils/logger');

class PostgresWriter {
  constructor({
    host = process.env.POSTGRES_HOST || 'postgres',
    port = process.env.POSTGRES_PORT || 5432,
    user = process.env.POSTGRES_USER || 'postgres',
    password = process.env.POSTGRES_PASSWORD || 'admin',
    database = process.env.POSTGRES_DB || 'scraper',
    logger: log = logger,
  } = {}) {
    this.logger = log;
    this.pool = new Pool({
      host,
      port: Number(port),
      user,
      password,
      database,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    this._connected = false;
  }
  async connect() {
    if (this._connected) return;
    try {
      console.log('[PostgresWriter] Intentando conectar a:', { host: this.pool.options.host, port: this.pool.options.port, user: this.pool.options.user, database: this.pool.options.database });
      await this.pool.query('SELECT 1');
      await this._runMigrations();
      this._connected = true;
      this.logger.info('[PostgresWriter] Conectado a PostgreSQL');
    } catch (error) {
      console.log('[PostgresWriter] Error completo:', error);
      this.logger.error(`[PostgresWriter] Error conectando: ${error.message}`);
      throw error;
    }
  }

  async _runMigrations() {
    const fs = require('fs');
    const path = require('path');
    const migrationDir = process.env.MIGRATIONS_DIR || path.join(__dirname, '../../migrations');
    if (!fs.existsSync(migrationDir)) {
      this.logger.warn(`[PostgresWriter] Directorio de migraciones no encontrado: ${migrationDir}`);
      return;
    }
    const files = fs.readdirSync(migrationDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
      await this.pool.query(sql);
      this.logger.info(`[PostgresWriter] Migración aplicada: ${file}`);
    }
  }

  async write(productName, products, scrapedAt = new Date()) {
    if (!this._connected) await this.connect();

    const query = `
      INSERT INTO scrape_results (producto, titulo, precio, link, tienda_oficial, envio_gratis, cuotas_sin_interes, scraped_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    let inserted = 0;
    for (const product of products) {
      try {
        await this.pool.query(query, [
          productName,
          product.titulo,
          product.precio,
          product.link,
          product.tienda_oficial,
          product.envio_gratis,
          product.cuotas_sin_interes,
          scrapedAt,
        ]);
        inserted++;
      } catch (error) {
        this.logger.warn(`[PostgresWriter] Error insertando producto: ${error.message}`);
      }
    }

    this.logger.info(`[PostgresWriter] ${inserted}/${products.length} productos guardados en PostgreSQL para "${productName}"`);
    return inserted;
  }

  async writeStats(productName, stats) {
    this.logger.info(`[PostgresWriter] Stats para "${productName}": min=$${stats.min}, max=$${stats.max}, median=$${stats.median}, stdDev=$${stats.stdDev.toFixed(2)}`);
  }

  async close() {
    await this.pool.end();
    this._connected = false;
    this.logger.info('[PostgresWriter] Conexión cerrada');
  }
}

module.exports = PostgresWriter;
