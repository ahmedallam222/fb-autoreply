import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dae6ff',
          500: '#3b6ef0',
          600: '#2956d6',
          700: '#2046ad',
        },
      },
    },
  },
  plugins: [],
};
export default config;
