/** @type {import('tailwindcss').Config} */
// Sistema de color de Qpro, derivado del logo (caramelo y cacao).
// orange → caramelo, gray → neutros cálidos y purple → petróleo, para que
// todas las pantallas compartan la misma paleta sin reescribir sus clases.
// Antes vivía en public/index.html con el CDN de Tailwind; algunos navegadores
// (Brave Shields, bloqueadores) bloqueaban ese script y la página salía sin estilos.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif']
      },
      colors: {
        espresso: '#2A1D15',
        orange: {
          50: '#FBF6F0', 100: '#F5E9DA', 200: '#EBD3B6', 300: '#DFB98D', 400: '#D3A372',
          500: '#C8955E', 600: '#A97644', 700: '#865B35', 800: '#654430', 900: '#4A3224', 950: '#2A1D15'
        },
        gray: {
          50: '#FAFAF9', 100: '#F5F5F4', 200: '#E7E5E4', 300: '#D6D3D1', 400: '#A8A29E',
          500: '#78716C', 600: '#57534E', 700: '#44403C', 800: '#292524', 900: '#1C1917', 950: '#0C0A09'
        },
        purple: {
          50: '#EFF7F7', 100: '#D8ECEE', 200: '#B2D8DC', 300: '#82BCC3', 400: '#4F9AA4', 500: '#2F7D88',
          600: '#23646E', 700: '#1E505A', 800: '#1B414A', 900: '#18363E', 950: '#0C2128'
        }
      },
      boxShadow: {
        card: '0 1px 2px rgba(42,29,21,.06), 0 8px 24px -12px rgba(42,29,21,.18)',
        lift: '0 2px 4px rgba(42,29,21,.06), 0 18px 40px -16px rgba(42,29,21,.28)'
      }
    }
  },
  plugins: []
};
