/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0B0F19',
        darkCard: '#161D30',
        darkBorder: '#1F293D',
      }
    },
  },
  plugins: [],
}
