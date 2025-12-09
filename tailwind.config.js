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
        // Royal blue chalk palette
        paper: {
          bg: '#03178C',      // Primary background (royal blue)
          card: '#021373',    // Card backgrounds (deep navy)
          deep: '#020F59',    // Modals, deeper elements
          accent: '#91AAF2',  // Accents, borders, links
          text: '#F2F2F2',    // Primary text
          muted: '#8BA3E6',   // Secondary/muted text
          // Legacy (keeping for gradual migration)
          border: '#91AAF2',  // Mapped to accent
          light: '#91AAF2',   // Mapped to accent
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
