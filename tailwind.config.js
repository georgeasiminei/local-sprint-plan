/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        panel: '#f8fafc',
        line: '#d8dee9',
        focus: '#2563eb',
      },
      boxShadow: {
        panel: '0 1px 2px rgb(15 23 42 / 0.08)',
      },
    },
  },
  plugins: [],
};
