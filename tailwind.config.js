/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: 'hsl(var(--muted))',
        card: 'hsl(var(--card))',
        border: 'hsl(var(--border))',
        primary: 'hsl(var(--primary))',
        accent: 'hsl(var(--accent))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
      },
      boxShadow: {
        glass: '0 10px 35px rgba(17, 19, 31, 0.35)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      backgroundImage: {
        mesh:
          'radial-gradient(circle at 10% 20%, rgba(56, 189, 248, 0.18), transparent 33%), radial-gradient(circle at 90% 0%, rgba(168, 85, 247, 0.18), transparent 30%), radial-gradient(circle at 50% 100%, rgba(45, 212, 191, 0.15), transparent 40%)',
      },
    },
  },
  plugins: [],
}
