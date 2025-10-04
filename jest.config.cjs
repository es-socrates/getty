module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['@swc/jest', { jsc: { target: 'es2022', parser: { syntax: 'ecmascript', dynamicImport: true } } }],
    '^.+\\.vue$': ['@swc/jest', { jsc: { target: 'es2022', parser: { syntax: 'ecmascript', dynamicImport: true } } }]
  },
  moduleFileExtensions: ['js','json','vue'],
  moduleDirectories: ['node_modules'],
  moduleNameMapper: {
    '^vue-i18n$': 'vue-i18n/dist/vue-i18n.cjs.js',
    '^shared-i18n/(.*)$': '<rootDir>/shared-i18n/$1'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(@?vue|vue-i18n|@intlify)/)'
  ],
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  globalTeardown: '<rootDir>/jest.teardown.js'
};
