/* eslint-disable */
module.exports = {
  content: [
    './src/**/*.html',
    './src/**/*.js',
    './public/**/*.html',
    './public/**/*.js',
    './admin-frontend/index.html',
    './admin-frontend/src/**/*.{vue,js,ts,jsx,tsx,html}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#ca004b',
          50: '#fdf2f7',
          100: '#fce7f1',
          200: '#fbcfe4',
          300: '#f9a8cd',
          400: '#f571ac',
          500: '#ed4789',
          600: '#ca004b',
          700: '#c40e4a',
          800: '#a30f40',
          900: '#8b103a',
        },
        success: '#00ff7f',
        error: '#ff4d4f',
        // Dark theme colors
        background: {
          DEFAULT: 'var(--bg-background)',
          dark: '#09080d',
          light: '#ffffff',
        },
        card: {
          DEFAULT: 'var(--bg-card)',
          dark: '#0f1214',
          light: '#f8fafc',
        },
        chat: {
          DEFAULT: 'var(--bg-chat)',
          dark: '#0f1214',
          light: '#f1f5f9',
        },
        border: {
          DEFAULT: 'var(--border-color)',
          dark: '#2d333b',
          light: '#e2e8f0',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
}
