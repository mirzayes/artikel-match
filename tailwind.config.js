/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Outfit', 'system-ui', 'sans-serif'],
        mono: ['"Space Mono"', 'ui-monospace', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        'artikl-heading': 'rgb(var(--artikl-heading-ch) / <alpha-value>)',
        'artikl-text': 'rgb(var(--artikl-text-ch) / <alpha-value>)',
        'artikl-muted2': 'var(--artikl-muted2)',
        'artikl-caption': 'var(--artikl-caption)',
        der: {
          DEFAULT: '#60a5fa',
          soft: 'rgba(96, 165, 250, 0.12)',
          ring: 'rgba(96, 165, 250, 0.35)',
        },
        die: {
          DEFAULT: '#f472b6',
          soft: 'rgba(244, 114, 182, 0.12)',
          ring: 'rgba(244, 114, 182, 0.35)',
        },
        das: {
          DEFAULT: '#34d399',
          soft: 'rgba(52, 211, 153, 0.12)',
          ring: 'rgba(52, 211, 153, 0.35)',
        },
        accent: {
          DEFAULT: '#7c6cf8',
          soft: 'rgba(124, 108, 248, 0.15)',
        },
      },
      boxShadow: {
        glass: '0 10px 40px rgba(28, 25, 23, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.75)',
        card: '0 4px 28px rgba(28, 25, 23, 0.05), 0 0 0 1px rgba(120, 113, 108, 0.09)',
        lift: '0 14px 44px rgba(28, 25, 23, 0.09)',
      },
      backdropBlur: {
        xs: '2px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out forwards',
      },
    },
  },
  plugins: [],
  safelist: ['ring-2', 'ring-der/30', 'ring-die/30', 'ring-das/30'],
};
