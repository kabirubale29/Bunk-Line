/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          bg: 'var(--bg-main)',
          card: 'var(--bg-card)',
          cardEl: 'var(--bg-card-elevated)',
          border: 'var(--border-color)',
          text: 'var(--text-primary)',
          textSec: 'var(--text-secondary)',
          textMuted: 'var(--text-muted)',
          primary: 'var(--color-primary)',
          primaryHover: 'var(--color-primary-hover)',
          primaryOn: 'var(--color-primary-on)',
          primaryTint: 'var(--color-primary-tint)',
        },
        // Functional Status colors & tints
        status: {
          safe: 'var(--status-safe)',
          safeTint: 'var(--status-safe-tint)',
          warning: 'var(--status-warning)',
          warningTint: 'var(--status-warning-tint)',
          danger: 'var(--status-danger)',
          dangerTint: 'var(--status-danger-tint)',
          neutral: 'var(--status-neutral)',
          neutralTint: 'var(--status-neutral-tint)',
          info: 'var(--indicator-now)',
          infoTint: 'var(--indicator-now-tint)',
        },
        // Subject accents
        accent: {
          purple: '#5B5BD6',
          cyan: '#0891B2',
          green: '#16A34A',
          amber: '#D97706',
          orange: '#EA580C',
          pink: '#DB2777',
          lavender: '#7C3AED',
          teal: '#0D9488',
        }
      },
      boxShadow: {
        warm: '0 1px 2px rgba(28, 28, 26, 0.06), 0 1px 3px rgba(28, 28, 26, 0.08)',
        'warm-lg': '0 4px 6px -1px rgba(28, 28, 26, 0.06), 0 2px 4px -1px rgba(28, 28, 26, 0.06)',
      }
    },
  },
  plugins: [],
}
