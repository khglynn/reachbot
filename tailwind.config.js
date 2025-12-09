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
          // Core palette
          bg: '#03178C',           // Primary background (royal blue)
          card: '#021373',         // Card backgrounds (deep navy)
          deep: '#020F59',         // Modals, deeper elements
          accent: '#91AAF2',       // Accents, borders, links
          text: '#F2F2F2',         // Primary text
          muted: '#8BA3E6',        // Secondary/muted text

          // Semantic: Success (green family)
          success: '#4ADE80',      // Main green
          'success-muted': '#166534', // Dark green bg

          // Semantic: Error (red family)
          error: '#F87171',        // Main red
          'error-muted': '#7F1D1D',   // Dark red bg

          // Semantic: Warning (amber family)
          warning: '#FBBF24',      // Main amber
          'warning-muted': '#78350F', // Dark amber bg

          // UI States
          hover: 'rgba(145, 170, 242, 0.15)',  // Accent with transparency
          active: 'rgba(145, 170, 242, 0.25)', // Stronger accent
          disabled: '#4B5563',     // Grayed out elements
          divider: 'rgba(145, 170, 242, 0.2)', // Subtle lines

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
