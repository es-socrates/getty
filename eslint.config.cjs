const js = require('@eslint/js');
const vue = require('eslint-plugin-vue');

module.exports = [
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  { ignores: [
      'public/**',
      '!public/js/*.js',
      'public/js/min/**',
      'public/admin-dist/**',
      'public/**/i18n-runtime*.js',
      'node_modules/**'
    ] },
  {
    files: [
      'server.js',
      'modules/**/*.js',
      'routes/**/*.js',
      'scripts/**/*.js',
      'lib/**/*.js',
      '*.cjs'
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        setImmediate: 'readonly'
      }
    },
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['tests/**/*.test.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        Buffer: 'readonly'
      }
    }
  },
  {
    files: ['admin-frontend/src/**/*.{js,vue}'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
        'vue/multi-word-component-names': 'off',
        'vue/max-attributes-per-line': 'off',
        'vue/html-self-closing': 'off',
        'vue/html-indent': 'off',
        'vue/singleline-html-element-content-newline': 'off',
        'vue/html-closing-bracket-newline': 'off',
        'vue/attributes-order': 'off',
        'no-console': ['warn', { allow: ['warn','error'] }],
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^e$|^err$', varsIgnorePattern: '^(MAX_TITLE_LEN|e)$' }],
        'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },
  {
    files: [
      'server.js',
      'modules/**/*.js',
      'routes/**/*.js',
      'scripts/**/*.js',
      'lib/**/*.js'
    ],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs' },
    rules: {
      'no-console': 'off',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_|^e$|^err$', varsIgnorePattern: '^(z|SETTINGS_FILE|saveAudioSettings|Logger|error|err|e|clientsNotified|WebSocket)$' }],
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  }
];
