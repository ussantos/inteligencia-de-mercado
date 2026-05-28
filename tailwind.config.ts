// Configuracao do Tailwind CSS.
// Ela diz em quais pastas o Tailwind deve procurar classes e define pequenas cores do tema.
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        market: {
          orange: '#f97316',
          dark: '#0f172a',
          blue: '#2563eb'
        }
      }
    }
  },
  plugins: []
};

export default config;
