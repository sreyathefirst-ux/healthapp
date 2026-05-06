/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#F5F0FF',
        card: '#FFFFFF',
        'accent-primary': '#C9B8FF',
        'accent-coral': '#FFB5A0',
        'accent-sage': '#B8E4C9',
        'accent-yellow': '#FFE4A0',
        'text-primary': '#1A1A2E',
        'text-secondary': '#6B6B8A',
      },
      borderRadius: {
        card: '20px',
        btn: '999px',
      },
      boxShadow: {
        card: '0px 4px 20px rgba(0,0,0,0.06)',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
