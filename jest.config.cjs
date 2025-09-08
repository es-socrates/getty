module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.[jt]sx?$': ['@swc/jest', { jsc: { target: 'es2022', parser: { syntax: 'ecmascript', dynamicImport: true } } }]
  },
  moduleFileExtensions: ['js','json','vue'],
  transformIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  globalTeardown: '<rootDir>/jest.teardown.js'
};
