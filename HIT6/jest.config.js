/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testTimeout: 300000,
  verbose: true,
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverage: true, // Fuerza la recolección
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html'], // Genera consola y HTML
  coverageThreshold: {
    global: {
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70
    }
  }
};
