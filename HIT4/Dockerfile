FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium chromium-driver ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV BROWSER=chrome \
    HEADLESS=true \
    CHROME_BIN=/usr/bin/chromium \
    OUTPUT_DIR=output \
    LOG_DIR=logs

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "run", "scrape:headless"]
