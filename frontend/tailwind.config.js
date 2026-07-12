/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Archivo', 'sans-serif'],
      },
      colors: {
        background: '#F5F2EA',
        bg: '#F5F2EA',
        surface: '#FFFFFF',
        surfaceHover: '#EFEBE0',
        border: '#191919',
        ink: '#191919',
        muted: '#6B675E',
        primary: {
          DEFAULT: '#1E4FD8',
          glow: 'rgba(30, 79, 216, 0.25)',
        },
        success: {
          DEFAULT: '#1B8A50',
          glow: 'rgba(27, 138, 80, 0.25)',
        },
        warning: {
          DEFAULT: '#E8A200',
          glow: 'rgba(232, 162, 0, 0.3)',
        },
        danger: {
          DEFAULT: '#D8341E',
          glow: 'rgba(216, 52, 30, 0.25)',
        },
        accentYellow: '#F2B305',
      },
      boxShadow: {
        bauhaus: '4px 4px 0 0 #191919',
        'bauhaus-sm': '2px 2px 0 0 #191919',
        'bauhaus-lg': '6px 6px 0 0 #191919',
      },
      keyframes: {
        sway: {
          '0%, 100%': { transform: 'rotate(-2.5deg)' },
          '50%': { transform: 'rotate(2.5deg)' },
        },
        'float-y': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
      },
      animation: {
        sway: 'sway 5s ease-in-out infinite',
        'sway-slow': 'sway 8s ease-in-out infinite',
        'float-y': 'float-y 6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
