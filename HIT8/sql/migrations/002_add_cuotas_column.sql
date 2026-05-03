-- Migration 002: Add cuotas_sin_interes column
-- Created: 2026-05-02

ALTER TABLE scrape_results ADD COLUMN IF NOT EXISTS cuotas_sin_interes TEXT;

COMMENT ON COLUMN scrape_results.cuotas_sin_interes IS 'Descripción de cuotas sin interés (si aplica)';
