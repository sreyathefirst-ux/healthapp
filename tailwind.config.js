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
        // Remapped to new Vitalia palette — all existing Tailwind classes auto-update
        bg: '#F9F8F6',
        card: '#FFFFFF',
        'accent-primary': '#A8D5BA',   // sage green (was purple #C9B8FF)
        'accent-coral': '#D4C5E8',     // lavender (was coral #FFB5A0)
        'accent-sage': '#A8D5BA',      // same as primary (was #B8E4C9)
        'accent-yellow': '#FAF8F4',    // warm white (was yellow #FFE4A0)
        'text-primary': '#1A1A2E',
        'text-secondary': '#5D5D6D',
        // Vitalia design system tokens
        'vitalia-sage': '#A8D5BA',
        'vitalia-lavender': '#D4C5E8',
        'vitalia-cream': '#FDFCFA',
        'vitalia-muted': '#8B8B9A',
        'vitalia-dim': '#C4C4D0',
        'vitalia-border': '#E8E6E3',
      },
      borderRadius: {
        card: '20px',
        btn: '10px',
        pill: '999px',
      },
      boxShadow: {
        card: '0px 4px 16px rgba(0,0,0,0.05)',
        'card-hover': '0px 8px 24px rgba(0,0,0,0.08)',
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
