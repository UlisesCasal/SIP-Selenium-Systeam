-- Migration 001: Create scrape_results table
-- Created: 2026-05-02

CREATE TABLE IF NOT EXISTS scrape_results (
    id             BIGSERIAL PRIMARY KEY,
    producto       TEXT      NOT NULL,
    titulo         TEXT      NOT NULL,
    precio         NUMERIC(12,2),
    link           TEXT,
    tienda_oficial TEXT,
    envio_gratis   BOOLEAN,
    scraped_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_results_producto_fecha
    ON scrape_results (producto, scraped_at DESC);

COMMENT ON TABLE scrape_results IS 'Almacena resultados de scraping de MercadoLibre';
COMMENT ON COLUMN scrape_results.producto IS 'Término de búsqueda utilizado';
COMMENT ON COLUMN scrape_results.titulo IS 'Título del producto extraído';
COMMENT ON COLUMN scrape_results.precio IS 'Precio en ARS';
COMMENT ON COLUMN scrape_results.link IS 'URL del producto';
COMMENT ON COLUMN scrape_results.tienda_oficial IS 'Nombre de la tienda oficial (si aplica)';
COMMENT ON COLUMN scrape_results.envio_gratis IS 'Indica si tiene envío gratis';
COMMENT ON COLUMN scrape_results.scraped_at IS 'Timestamp del scraping';
