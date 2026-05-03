FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-alpine
WORKDIR /app

# Instalación de dependencias para Selenium/Chromium en Alpine
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    udev

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    CHROME_BIN=/usr/bin/chromium-browser

# Copiamos las dependencias
COPY --from=builder --chown=node:node /app/node_modules ./node_modules

# Copiamos todo el contenido de HIT8 (src, migrations, sql, etc.)
COPY --chown=node:node . .

# --- ESTA ES LA PARTE CLAVE PARA EL ERROR EACCES ---
# Creamos la carpeta de logs y aseguramos permisos sobre todo /app
RUN mkdir -p /app/logs && chown -R node:node /app

USER node

# Ejecución del scraper principal
CMD ["node", "src/scrapers/mercadolibre.js"]