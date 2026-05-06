"use strict";

const fs = require("fs");
const path = require("path");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");

const memoryLogs = [];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function createLogger({
  logDir = process.env.LOG_DIR || "logs",
  level = process.env.LOG_LEVEL || "info",
} = {}) {
  const absoluteLogDir = path.resolve(__dirname, "../../", logDir);
  ensureDir(absoluteLogDir);

  const fileFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ssZ" }),
    winston.format.printf(({ timestamp, level: lvl, message, ...meta }) => {
      const metaStr = Object.keys(meta).length
        ? ` ${JSON.stringify(meta)}`
        : "";
      const line = `${timestamp} | ${lvl.toUpperCase().padEnd(8)} | ${message}${metaStr}`;
      memoryLogs.push(line);
      return line;
    }),
  );

  const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ssZ" }),
    winston.format.json()
  );

  const transports = [
    new winston.transports.Console({
      format: jsonFormat,
    }),
    new DailyRotateFile({
      dirname: absoluteLogDir,
      filename: "scraper-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "2m",
      maxFiles: 3,
      level,
      format: fileFormat,
    }),
    new DailyRotateFile({
      dirname: absoluteLogDir,
      filename: "error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxSize: "2m",
      maxFiles: 3,
      level: "error",
      format: fileFormat,
    }),
  ];

  return winston.createLogger({ level, transports });
}

const logger = createLogger();

logger.memory = {
  all: () => [...memoryLogs],
  clear: () => {
    memoryLogs.length = 0;
  },
};

module.exports = logger;