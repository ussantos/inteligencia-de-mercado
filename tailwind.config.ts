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
        myrobot: {
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
