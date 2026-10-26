/**
 * Jest projects: unit (pure logic), integration (real PostgreSQL), contract (provider payload
 * mapping), e2e (HTTP scenarios through the full Nest app with the mock provider).
 * Run a single project with `--selectProjects <name>`.
 */
const base = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/support/jest-setup.ts'],
  clearMocks: true,
  restoreMocks: true,
};

module.exports = {
  coverageDirectory: './coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/cli/**', '!src/scripts/**', '!src/main.ts', '!src/worker.ts'],
  projects: [
    { ...base, displayName: 'unit', testMatch: ['<rootDir>/test/unit/**/*.spec.ts'] },
    {
      ...base,
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
      globalSetup: '<rootDir>/test/support/global-setup.ts',
    },
    { ...base, displayName: 'contract', testMatch: ['<rootDir>/test/contract/**/*.spec.ts'] },
    {
      ...base,
      displayName: 'e2e',
      testMatch: ['<rootDir>/test/e2e/**/*.spec.ts'],
      globalSetup: '<rootDir>/test/support/global-setup.ts',
    },
  ],
};
