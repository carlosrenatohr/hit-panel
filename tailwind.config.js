/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Matches the marketing site (hit-cargo-web) brand tokens.
        primary: { DEFAULT: '#FF3B3F', dark: '#D92E31' },
        secondary: { DEFAULT: '#111111', light: '#2D2D2D' },
        accent: { yellow: '#FFD700', blue: '#00A8E8' },
        neutral: { text: '#4A4A4A', bg: '#F8F9FA' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
