module.exports = {
  content: [
    "./public/**/*.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
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
        background: '#09080d',
        card: '#0f1214',
        chat: '#0f1214',
        border: '#2d333b',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}