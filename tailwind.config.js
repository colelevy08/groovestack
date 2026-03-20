/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        gs: {
          bg: '#080808',
          card: '#0f0f0f',
          surface: '#0d0d0d',
          sidebar: '#0a0a0a',
          border: '#1e1e1e',
          'border-subtle': '#161616',
          'border-hover': '#2a2a2a',
          accent: '#0ea5e9',
          indigo: '#6366f1',
          text: '#f5f5f5',
          muted: '#888888',
          dim: '#555555',
          faint: '#444444',
          subtle: '#333333',
        },
      },
      fontFamily: {
        sans: ["'DM Sans'", '-apple-system', 'sans-serif'],
        mono: ["'DM Mono'", 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
