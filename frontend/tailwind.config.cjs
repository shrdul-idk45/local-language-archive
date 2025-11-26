// tailwind.config.cjs
module.exports = {
  // 🔥 this line makes `.dark` class work
  darkMode: 'class',

  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#eaeeff',
          200: '#c6d1ff',
          300: '#9baeff',
          400: '#6f8bff',
          500: '#4a6bff', // main
          600: '#3352e6',
          700: '#243bb4',
          800: '#1b2a83',
          900: '#11194f'
        },
        accent: {
          50: '#fff6f8',
          100: '#ffecf0',
          300: '#ffa8c5',
          500: '#ff6fa8'
        },
        muted: {
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db'
        }
      },
      borderRadius: {
        xl: '1rem'
      },
      boxShadow: {
        soft: '0 6px 20px rgba(22, 27, 38, 0.08)'
      }
    }
  },
  plugins: [],
};

