const js = require('@eslint/js');
const vue = require('eslint-plugin-vue');

module.exports = [
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  { ignores: [
      'public/**',
      '!public/js/*.js',
      'public/js/min/**',
      'dist/**',
      'public/**/i18n-runtime*.js',
      'node_modules/**'
    ] },

  {
    files: [
      'server.js',
      'createServer.js',
      'modules/**/*.js',
      'app/**/*.js',
      'routes/**/*.js',
      'scripts/**/*.js',
      'services/**/*.js',
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
      'no-console': 'off',
      'no-legacy-token-direct/no-legacy-token-direct': 'off'
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
        global: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        jest: 'readonly',
        Buffer: 'readonly'
      }
    },
    rules: {
      'no-legacy-token-direct/no-legacy-token-direct': 'off'
    }
  },
  {
    files: ['jest.setup.js', 'tests/mocks/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        require: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        process: 'readonly',
        jest: 'readonly',
        afterAll: 'readonly',
        beforeAll: 'readonly',
        Buffer: 'readonly',
        setImmediate: 'readonly'
      }
    },
    rules: {
      'no-undef': 'off',
      'no-legacy-token-direct/no-legacy-token-direct': 'off'
    }
  },
  {
    files: ['admin-frontend/src/**/*.{js,vue}', 'public/js/**/*.js', '!public/js/lib/token-compat.js'],
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
    files: ['tests/wsNamespaceIsolation.test.js'],
    rules: {
      'no-console': 'off'
    }
  }
];
