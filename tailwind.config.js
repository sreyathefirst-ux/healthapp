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
        // Surfaces — warm paper
        bg: '#F1F5F9',
        'bg-2': '#EDF2F8',
        'bg-3': '#E8EDF4',
        card: '#FFFFFF',

        // Brand — Vitalia gradient hues (green → blue → violet)
        green: '#07C281',
        'green-deep': '#04976A',
        teal: '#06BBC4',
        blue: '#2BAEE6',
        violet: '#9B53E6',
        lavender: '#8257FF',
        amber: '#FF9A2E',
        rose: '#FF4D8D',

        // Token aliases — backward compat with existing class names
        'accent-primary': '#07C281',
        'accent-coral': '#8257FF',
        'accent-sage': '#1FD7A4',
        'accent-yellow': '#EDF2F8',

        // Text — warm charcoal-green family
        'text-primary': '#16201B',
        'text-body': '#454D44',
        'text-secondary': '#6C736C',

        // Design system tokens
        'vitalia-border': '#E2E8F0',
        'vitalia-muted': '#969C95',
        'vitalia-dim': '#969C95',
        'vitalia-sage': '#1FD7A4',
        'vitalia-lavender': '#8257FF',
        'vitalia-cream': '#F6FCF9',
        'vitalia-fill': '#EDF2F8',
        'vitalia-line': '#E2E8F0',
        'vitalia-faint': '#B0B5AE',
      },
      borderRadius: {
        sm: '10px',
        md: '14px',
        card: '22px',
        lg: '24px',
        btn: '13px',
        pill: '999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(36,40,30,.04), 0 4px 12px rgba(36,40,30,.04)',
        card: '0 1px 2px rgba(36,40,30,.04), 0 12px 30px rgba(36,40,30,.06)',
        'card-hover': '0 1px 2px rgba(36,40,30,.05), 0 20px 40px rgba(36,40,30,.10)',
        'card-lg': '0 24px 60px rgba(36,40,30,.14)',
      },
      fontFamily: {
        sans: ['DM Sans', '-apple-system', 'system-ui', 'sans-serif'],
        display: ['Bricolage Grotesque', '-apple-system', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'vitalia-gradient': 'linear-gradient(135deg, #0FCB8C 0%, #2BAEE6 50%, #9B53E6 100%)',
        'vitalia-gradient-warm': 'linear-gradient(135deg, #10D898 0%, #0FC7C2 100%)',
        'vitalia-gradient-header': 'linear-gradient(180deg, #DEFAEE 0%, #E2F0FC 38%, #EBE5FD 72%, #F1F5F9 100%)',
        'vitalia-gradient-home': 'linear-gradient(150deg, #D2F6E7 0%, #D6EAFB 48%, #E9DCFD 100%)',
      },
    },
  },
  plugins: [],
}
