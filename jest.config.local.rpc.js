const path = require('path');

const config = {
  rootDir: path.resolve(__dirname),
  testTimeout: 120000,
  reporters: [
    "default",
    [
      "jest-html-reporter", {
      pageTitle: "RPC Test Report",
      outputPath: getReportPath('local'),
      includeFailureMsg: true,
    }
    ],
  ],
  roots: ['<rootDir>/src/rpc-tests'],
  testMatch: [
    '**/?(*.)+(spec|test).[tj]s?(x)',
  ],
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx', 'node'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  preset: 'ts-jest',
  testEnvironment: 'node',
  globalSetup: '<rootDir>/jest.setup.js',
  globalTeardown: '<rootDir>/jest.teardown.js',
};

function getReportPath(testEnv) {
  const timestamp = new Date().toISOString().replace(/:/g, "-").slice(0, -5);
  return path.resolve(__dirname, `reports/test-report-${testEnv}-${timestamp}.html`);
}

module.exports = config;
