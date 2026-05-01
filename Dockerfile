# Stage 1: Construcción (Builder)
FROM node:20.12.2-slim AS builder

WORKDIR /app

# Copiar manifiestos y descargar dependencias
COPY package*.json ./
RUN npm ci

# Copiar el código fuente
COPY . .

# Stage 2: Runtime
FROM node:20.12.2-slim AS runtime

WORKDIR /app

# Variables de entorno para evitar prompts interactivos
ENV DEBIAN_FRONTEND=noninteractive

# 1. Instalar dependencias críticas del sistema para Headless Selenium
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    gnupg \
    ca-certificates \
    unzip \
    libnss3 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libx11-xcb1 \
    firefox-esr \
    && rm -rf /var/lib/apt/lists/*

# 2. Instalar Google Chrome Stable de forma manual
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    && rm -rf /var/lib/apt/lists/*

# 3. Instalar ChromeDriver genérico (coincidente con la versión stable o última disponible)
RUN npx -y @puppeteer/browsers install chromedriver@latest --path /usr/local/bin \
    && mv /usr/local/bin/chromedriver/*/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver-bin \
    && ln -s /usr/local/bin/chromedriver-bin /usr/local/bin/chromedriver \
    && chmod +x /usr/local/bin/chromedriver

# 4. Instalar GeckoDriver (para Firefox ESR)
RUN wget -q "https://github.com/mozilla/geckodriver/releases/download/v0.34.0/geckodriver-v0.34.0-linux64.tar.gz" \
    && tar -xzf geckodriver-v0.34.0-linux64.tar.gz -C /usr/local/bin \
    && rm geckodriver-v0.34.0-linux64.tar.gz \
    && chmod +x /usr/local/bin/geckodriver

# Copiar archivos compilados y dependencias de la etapa builder
COPY --from=builder /app /app

# 5. Crear usuario no-root por seguridad y establecer permisos del volumen
RUN useradd -m -s /bin/bash scraperuser \
    && mkdir -p /app/output \
    && chown -R scraperuser:scraperuser /app

# Cambiamos al usuario creado
USER scraperuser

# 6. Definir el Entrypoint.
# Esto asegura que los argumentos del `docker run` se pasen a `node src/index.js`
ENTRYPOINT ["node", "src/index.js"]
