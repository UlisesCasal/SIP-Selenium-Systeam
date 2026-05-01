'use strict';

const fs = require('fs');
const path = require('path');
const winston = require('winston');

const memoryLogs = [];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function createLogger({ logDir = process.env.LOG_DIR || 'logs', level = process.env.LOG_LEVEL || 'info' } = {}) {
  const absoluteLogDir = path.resolve(__dirname, '../../', logDir);
  ensureDir(absoluteLogDir);

  const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level: lvl, message }) => {
      const line = `[${timestamp}] ${lvl.toUpperCase().padEnd(5)}: ${message}`;
      memoryLogs.push(line);
      return line;
    })
  );

  return winston.createLogger({
    level,
    format,
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), format),
      }),
      new winston.transports.File({ filename: path.join(absoluteLogDir, 'scraper.log') }),
      new winston.transports.File({ filename: path.join(absoluteLogDir, 'error.log'), level: 'error' }),
    ],
  });
}

const logger = createLogger();

logger.memory = {
  all: () => [...memoryLogs],
  clear: () => { memoryLogs.length = 0; },
};

module.exports = logger;
