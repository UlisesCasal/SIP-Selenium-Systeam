/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testTimeout: 300000,
  verbose: true,
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverage: true,
  coverageDirectory: "coverage",
  coverageReporters: ["text", "html"],

  collectCoverageFrom: [
    "src/**/*.js",
    "!src/scrapers/mercadolibre.js",
    "!src/utils/BrowserFactory.js",
    "!src/config/ScraperConfig.js",
    "!src/utils/validate-output.js",
    "!src/pages/**/*.js",
  ],

  coverageThreshold: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70,
    },
  },
};
