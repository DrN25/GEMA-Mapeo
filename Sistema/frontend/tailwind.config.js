/** @type {import('tailwindcss').Config} */
function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`;
    }
    return `rgb(var(${variableName}))`;
  };
}

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontSize: {
        'xxs': '0.65rem',
      },
      colors: {
        navy: {
          50: withOpacity('--navy-50'),
          100: withOpacity('--navy-100'),
          200: withOpacity('--navy-200'),
          300: withOpacity('--navy-300'),
          400: withOpacity('--navy-400'),
          500: withOpacity('--navy-500'),
          600: withOpacity('--navy-600'),
          700: withOpacity('--navy-700'),
          800: withOpacity('--navy-800'),
          850: withOpacity('--navy-850'),
          900: withOpacity('--navy-900'),
          950: withOpacity('--navy-950'),
        }
      }
    },
  },
  plugins: [],
}
