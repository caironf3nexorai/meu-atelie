/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-text-primary)',
        surface: 'var(--color-surface)',
        'surface-warm': 'var(--color-surface-warm)',
        primary: {
          DEFAULT: 'var(--color-primary)',
          dark: 'var(--color-primary-hover)',
          light: 'var(--color-primary-hover)', // Fallbacks if needed
          foreground: 'var(--color-surface)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          light: 'var(--color-accent)', // Fallbacks
          foreground: 'var(--color-surface)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          hover: 'var(--color-secondary-hover)',
          foreground: '#FFFFFF',
        },
        warn: {
          DEFAULT: 'var(--color-warning)',
          foreground: 'var(--color-surface)',
        },
        muted: {
          DEFAULT: 'var(--color-border-light)',
          foreground: 'var(--color-text-muted)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          light: 'var(--color-border-light)',
        },
        card: {
          DEFAULT: 'var(--color-surface)',
          foreground: 'var(--color-text-primary)',
        },
        text: {
          DEFAULT: 'var(--color-text-primary)',
          light: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
        },
        destructive: {
          DEFAULT: 'var(--color-error)',
          foreground: 'var(--color-surface)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          foreground: 'var(--color-surface)',
        }
      },
      fontFamily: {
        display: ['var(--font-playfair)', 'serif'],
        ui: ['var(--font-nunito)', 'sans-serif'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      animation: {
        'blur-up': 'blurUp 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'float': 'float 6s ease-in-out infinite',
        'marquee': 'marquee 30s linear infinite',
      },
      keyframes: {
        blurUp: {
          '0%': { opacity: '0', filter: 'blur(16px)', transform: 'translateY(24px)' },
          '100%': { opacity: '1', filter: 'blur(0)', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        }
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
}
