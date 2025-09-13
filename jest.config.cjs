module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['@swc/jest', { jsc: { target: 'es2022', parser: { syntax: 'ecmascript', dynamicImport: true } } }],
    '^.+\\.vue$': ['@swc/jest', { jsc: { target: 'es2022', parser: { syntax: 'ecmascript', dynamicImport: true } } }]
  },
  moduleFileExtensions: ['js','json','vue'],
  transformIgnorePatterns: [
    '/node_modules/(?!(vue|vue-i18n)/)'
  ],
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  globalTeardown: '<rootDir>/jest.teardown.js'
};
