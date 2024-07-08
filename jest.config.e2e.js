const path = require('path');

const config = {
  rootDir: path.resolve(__dirname, 'src'),
  testTimeout: 120000,
  roots: ['<rootDir>/e2e-tests'],
  testMatch: [
    '**/?(*.)+(spec|test).[tj]s?(x)',
  ],
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx', 'node'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  preset: 'ts-jest',
  testEnvironment: 'node',
  reporters: ["default"],
  testPathIgnorePatterns: [
    '<rootDir>/e2e-tests/services/'
  ],
};

module.exports = config;
