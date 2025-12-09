/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Architecture paper blue palette
        paper: {
          bg: '#0f1729',
          card: '#1a2744',
          border: '#2d4a7c',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
