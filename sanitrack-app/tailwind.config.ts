import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        health: {
          normal: {
            DEFAULT: '#22c55e',
            light: '#bbf7d0',
            dark: '#15803d',
          },
          warning: {
            DEFAULT: '#f59e0b',
            light: '#fde68a',
            dark: '#b45309',
          },
          danger: {
            DEFAULT: '#ef4444',
            light: '#fecaca',
            dark: '#b91c1c',
          },
          critical: {
            DEFAULT: '#a855f7',
            light: '#e9d5ff',
            dark: '#7e22ce',
          },
        },
      },
    },
  },
  plugins: [],
};

export default config;