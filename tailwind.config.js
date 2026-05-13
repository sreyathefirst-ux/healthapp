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
        // Vitalia design system
        'vitalia-sage': '#A8D5BA',
        'vitalia-lavender': '#D4C5E8',
        'vitalia-cream': '#FDFCFA',
        'vitalia-muted': '#8B8B9A',
        'vitalia-dim': '#C4C4D0',
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
        script: ['Great Vibes', 'cursive'],
      },
      backgroundImage: {
        'vitalia-intro': 'linear-gradient(180deg, #FDFCFA 0%, #F9F8F6 50%, #F3F8F5 100%)',
      },
    },
  },
  plugins: [],
}
