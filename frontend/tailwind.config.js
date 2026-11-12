/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: '#1B7A3D', dark: '#145C2E' },
        sunset: { DEFAULT: '#F5821F', dark: '#B85E10' },
        chili: '#E31E24',
        cream: '#FBF6EA',
        ink: '#26201A',
        gold: '#FFC145',
      },
      fontFamily: {
        display: ['"Baloo 2"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"Space Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
