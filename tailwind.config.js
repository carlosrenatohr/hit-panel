/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Matches the marketing site (hit-cargo-web) brand book §03.
        // Naranja HIT = protagonist (action/focus); navy = strategic support (chrome/base); black = base.
        primary: {
          50: '#FFF3E6',
          100: '#FFDCB3',
          300: '#FFB870',
          400: '#FF9433',
          DEFAULT: '#FF7A00',
          500: '#FF7A00',
          600: '#E56E00',
          700: '#B35600',
          800: '#803E00',
          dark: '#E56E00',
        },
        secondary: { DEFAULT: '#111111', light: '#2D2D2D' },
        navy: { DEFAULT: '#14213D', light: '#1E2E4F' },
        accent: { yellow: '#FFD700', blue: '#00A8E8' },
        neutral: { text: '#4A4A4A', bg: '#F8F9FA' },
      },
      fontFamily: {
        // Brand book §04 — Poppins reads (body), Montserrat carries impact (headings).
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        heading: ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
