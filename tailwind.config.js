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
        // Page / surface backgrounds
        bg: '#ffffff',
        'bg-2': '#f1f5f9',   // Slate 100
        'bg-3': '#e2e8f0',   // Slate 200

        card: '#ffffff',

        // Brand primaries — updated to new design system
        teal: '#10b981',             // Emerald 500  (was #5DDAB8)
        lavender: '#9333ea',         // Purple 600   (was #B48FE8)

        // Aliases (keep names so existing classes auto-update)
        'accent-primary': '#10b981', // Emerald 500
        'accent-coral':   '#9333ea', // Purple 600
        'accent-sage':    '#34d399', // Emerald 400  (gradient start)
        'accent-yellow':  '#f1f5f9', // Slate 100

        // Text scale — updated to Slate palette
        'text-primary':   '#0f172a', // Slate 900
        'text-body':      '#475569', // Slate 600
        'text-secondary': '#64748b', // Slate 500

        // Border / muted — updated to Slate palette
        'vitalia-border':   '#e2e8f0', // Slate 200
        'vitalia-muted':    '#64748b', // Slate 500
        'vitalia-dim':      '#64748b', // Slate 500
        'vitalia-sage':     '#10b981', // Emerald 500
        'vitalia-lavender': '#9333ea', // Purple 600
        'vitalia-cream':    '#f8fafc', // Slate 50
      },
      borderRadius: {
        sm:   '10px',
        md:   '14px',
        card: '16px',   // tightened slightly to match new design
        lg:   '24px',
        btn:  '999px',
        pill: '999px',
      },
      boxShadow: {
        card:       '0px 1px 4px rgba(0,0,0,0.06), 0px 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0px 4px 16px rgba(0,0,0,0.08)',
        'card-lg':  '0px 8px 32px rgba(0,0,0,0.10)',
      },
      fontFamily: {
        sans:    ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        heading: ['Poppins', 'sans-serif'],
      },
      backgroundImage: {
        // Updated gradient: Emerald 500 → Purple 600
        'vitalia-gradient': 'linear-gradient(to right, #10b981 0%, #9333ea 100%)',
      },
    },
  },
  plugins: [],
}
