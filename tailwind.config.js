export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink:   '#0E1712',
        bark:  '#16241A',
        moss:  '#1F3A26',
        pine:  '#2C5233',
        fern:  '#3E5B47',
        sage:  '#E4EAD9',
        haze:  '#9CB09B',
        amber: '#C97A1F',
        ember: '#C0483B',
        fresh: '#7FA96A',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Archivo', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
}
