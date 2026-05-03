CREATE TABLE IF NOT EXISTS scrape_results (
    id              BIGSERIAL PRIMARY KEY,
    producto        TEXT         NOT NULL,
    titulo          TEXT         NOT NULL,
    precio          NUMERIC(12,2),
    link            TEXT,
    tienda_oficial  BOOLEAN,
    envio_gratis    BOOLEAN,
    cuotas_sin_interes BOOLEAN,
    scraped_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scrape_results_producto_fecha
    ON scrape_results (producto, scraped_at DESC);
