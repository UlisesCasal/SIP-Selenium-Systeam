const { NodeSDK } = require('@opentelemetry/sdk-node');
const { OTLPLogExporter } = require('@opentelemetry/exporter-logs-otlp-grpc');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { SimpleLogRecordProcessor } = require('@opentelemetry/sdk-logs');
const { SimpleSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const { SEMRESATTRS_SERVICE_NAME } = require('@opentelemetry/semantic-conventions');
const { WinstonInstrumentation } = require('@opentelemetry/instrumentation-winston');
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http');

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: 'scraper',
  }),
  spanProcessor: new SimpleSpanProcessor(
    new OTLPTraceExporter({ url: endpoint })
  ),
  logRecordProcessor: new SimpleLogRecordProcessor(
    new OTLPLogExporter({ url: endpoint })
  ),
  instrumentations: [
    new HttpInstrumentation(),
    new WinstonInstrumentation(),
  ],
});

sdk.start();

async function shutdown() {
  try {
    await sdk.shutdown();
  } catch (err) {
    console.error('Error shutting down OTel SDK', err);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('beforeExit', shutdown);