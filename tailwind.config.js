/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        gs: {
          bg: 'var(--gs-bg, #080808)',
          card: 'var(--gs-card, #0f0f0f)',
          surface: 'var(--gs-surface, #0d0d0d)',
          sidebar: 'var(--gs-sidebar, #0a0a0a)',
          border: 'var(--gs-border, #1e1e1e)',
          'border-subtle': 'var(--gs-border-subtle, #161616)',
          'border-hover': 'var(--gs-border-hover, #2a2a2a)',
          accent: 'var(--gs-accent, #0ea5e9)',
          indigo: 'var(--gs-indigo, #6366f1)',
          text: 'var(--gs-text, #f5f5f5)',
          muted: 'var(--gs-muted, #888888)',
          dim: 'var(--gs-dim, #555555)',
          faint: 'var(--gs-faint, #444444)',
          subtle: 'var(--gs-subtle, #333333)',
        },
      },
      fontFamily: {
        sans: ["'DM Sans'", '-apple-system', 'sans-serif'],
        mono: ["'DM Mono'", 'monospace'],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
        'heart-pop': 'heartPop 0.35s ease-out',
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
        'page-in': 'pageIn 0.3s ease-out',
        'double-tap-heart': 'doubleTapHeart 0.8s ease-out forwards',
        'modal-in': 'modalIn 0.2s ease-out',
        'modal-out': 'modalOut 0.15s ease-in forwards',
        'overlay-in': 'overlayIn 0.2s ease-out',
        'overlay-out': 'overlayOut 0.15s ease-in forwards',
        'toast-in': 'toastIn 0.3s ease-out',
        'toast-out': 'toastOut 0.2s ease-in forwards',
        'shimmer': 'shimmer 1.8s ease-in-out infinite',
        'spin-slow': 'spinSlow 8s linear infinite',
        'mode-switch': 'modeSwitch 0.35s ease-out',
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
        modalIn: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(8px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        modalOut: {
          '0%': { opacity: '1', transform: 'scale(1) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(0.95) translateY(8px)' },
        },
        overlayIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        overlayOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateX(-50%) translateY(16px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateX(-50%) translateY(0) scale(1)' },
        },
        toastOut: {
          '0%': { opacity: '1', transform: 'translateX(-50%) translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateX(-50%) translateY(16px) scale(0.95)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        heartPop: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.35)' },
          '100%': { transform: 'scale(1)' },
        },
        skeleton: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pageIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        spinSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        modeSwitch: {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        doubleTapHeart: {
          '0%': { opacity: '0', transform: 'translate(-50%, -50%) scale(0)' },
          '15%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1.2)' },
          '30%': { transform: 'translate(-50%, -50%) scale(1)' },
          '80%': { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
          '100%': { opacity: '0', transform: 'translate(-50%, -50%) scale(0.8)' },
        },
      },
    },
  },
  plugins: [],
};
