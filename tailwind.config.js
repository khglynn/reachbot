/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        fascinate: ['var(--font-fascinate)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Deep purple chalk palette
        paper: {
          // Core palette (dark to light)
          bg: '#0D0221',           // Primary background (deep plum)
          card: '#1A0533',         // Card backgrounds (rich purple)
          surface: '#2D1054',      // Elevated surfaces, highlights
          accent: '#9F7AEA',       // Accents, borders, links (muted violet)
          text: '#F2F2F2',         // Primary text
          muted: '#A78BFA',        // Secondary/muted text (soft purple)

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
          hover: 'rgba(159, 122, 234, 0.15)',  // Accent with transparency
          active: 'rgba(159, 122, 234, 0.25)', // Stronger accent
          disabled: '#4B5563',     // Grayed out elements
          divider: 'rgba(159, 122, 234, 0.2)', // Subtle lines

          // Legacy (keeping for gradual migration)
          border: '#9F7AEA',  // Mapped to accent
          light: '#9F7AEA',   // Mapped to accent
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
