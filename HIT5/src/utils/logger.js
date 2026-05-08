"use strict";

const winston = require("winston");
const { OpenTelemetryTransportV3 } = require("@opentelemetry/winston-transport");

// Dejamos el array de memoria por si algún test viejo del TP1 lo necesita para no romperse
const memoryLogs = [];

function createLogger({
  level = process.env.LOG_LEVEL || "info",
} = {}) {
  
  const jsonFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ssZ" }),
    winston.format.json()
  );

  const transports = [
    new winston.transports.Console({
      format: jsonFormat,
    }),
    new OpenTelemetryTransportV3()
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