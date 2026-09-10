/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1C2521',
        paper: '#F7F5F0',
        surface: '#FFFFFF',
        primary: {
          DEFAULT: '#1F5E5B',
          light: '#2C7A76',
          dark: '#153F3D'
        },
        accent: {
          DEFAULT: '#C77D2E',
          light: '#E0954A'
        },
        line: '#E4E0D6',
        danger: '#B0473E',
        success: '#2F7A4D'
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        card: '10px'
      }
    }
  },
  plugins: []
}
