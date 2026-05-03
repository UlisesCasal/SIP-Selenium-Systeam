/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testTimeout: 10000,
  verbose: true,
  testMatch: ["<rootDir>/tests/**/*.test.js"],
  collectCoverageFrom: ["<rootDir>/src/**/*.js"],
};
