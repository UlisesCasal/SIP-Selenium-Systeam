# ============ Stage 1: builder (deps + compile) ============
FROM node:24-trixie-slim AS builder
WORKDIR /app
# System deps para compilar wheels si hace falta
COPY HIT5/package*.json ./HIT5/
RUN cd HIT5 && npm ci --ignore-scripts
COPY HIT6/package*.json ./HIT6/
RUN cd HIT6 && npm ci --ignore-scripts

# ============ Stage 2: runtime (browsers + app) ============
FROM node:24-trixie-slim AS runtime
WORKDIR /app
# Instalar Google Chrome stable + Firefox + deps mínimas
# Nota: NO uses `chromium` de Debian trixie (bug de crashpad en headless).
# Usá google-chrome-stable del repo oficial.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gnupg \
    firefox-esr \
    fonts-liberation \
    && curl -fsSL https://dl.google.com/linux/linux_signing_key.pub \
       | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
       > /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update && apt-get install -y --no-install-recommends \
       google-chrome-stable \
    && apt-get purge -y curl gnupg \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

# Copiar deps de Node desde el builder
COPY --from=builder --chown=node:node /app/HIT5/node_modules ./HIT5/node_modules
COPY --from=builder --chown=node:node /app/HIT6/node_modules ./HIT6/node_modules

# Copiar resto del código
COPY --chown=node:node . .

# Crear directorios necesarios con permisos correctos (necesitamos root temporalmente)
USER root
RUN mkdir -p /app/HIT5/logs /app/HIT5/output && chown -R node:node /app/HIT5/logs /app/HIT5/output && chmod -R u+w /app/HIT5/logs /app/HIT5/output
USER node

# Healthcheck — opcional pero recomendado
HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "require('selenium-webdriver'); console.log('ok')" || exit 1

ENTRYPOINT ["node", "HIT5/src/scrapers/mercadolibre.js"]