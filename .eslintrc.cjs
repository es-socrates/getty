module.exports = {
  root: true,
  env: { browser: true, node: true, es2022: true, jest: true },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    '@vue/eslint-config-standard',
    'plugin:import/recommended',
    'plugin:promise/recommended'
  ],
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['vue', 'import', 'promise'],
  settings: {
    'import/resolver': {
      node: { extensions: ['.js', '.mjs', '.cjs', '.vue'] }
    }
  },
  rules: {
    'vue/multi-word-component-names': 'off',
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'import/no-unresolved': 'off'
  },
  ignorePatterns: [
    'public/js/min/**',
    'admin-frontend/dist/**',
    'public/**/i18n-runtime*.js'
  ],
  overrides: [
    {
      files: ['**/*.test.js'],
      env: { jest: true }
    }
  ]
};
