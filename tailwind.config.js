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
        // Backgrounds
        bg: '#FFFFFF',
        'bg-2': '#F8F9FA',
        'bg-3': '#F3F4F6',
        card: '#FFFFFF',
        // Brand colors
        teal: '#5DDAB8',
        lavender: '#B48FE8',
        // Token aliases (keep same names so existing classes auto-update)
        'accent-primary': '#5DDAB8',   // teal
        'accent-coral': '#B48FE8',     // lavender
        'accent-sage': '#6FD8A0',      // gradient start
        'accent-yellow': '#F8F9FA',    // secondary bg
        // Text
        'text-primary': '#1A1A2E',
        'text-body': '#4A4A5A',
        'text-secondary': '#6B6B8A',
        // Design system tokens
        'vitalia-border': '#EBEBF0',
        'vitalia-muted': '#9B9BAA',
        'vitalia-dim': '#9B9BAA',
        'vitalia-sage': '#6FD8A0',
        'vitalia-lavender': '#B48FE8',
        'vitalia-cream': '#F8F9FA',
      },
      borderRadius: {
        sm: '10px',
        md: '14px',
        card: '20px',
        lg: '24px',
        btn: '999px',   // pill CTAs
        pill: '999px',
      },
      boxShadow: {
        card: '0px 2px 8px rgba(0,0,0,0.06)',
        'card-hover': '0px 4px 16px rgba(0,0,0,0.08)',
        'card-lg': '0px 8px 32px rgba(0,0,0,0.10)',
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      backgroundImage: {
        'vitalia-gradient': 'linear-gradient(135deg, #6FD8A0 0%, #5DDAB8 50%, #B48FE8 100%)',
      },
    },
  },
  plugins: [],
}
