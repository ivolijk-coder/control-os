import type { Config } from 'tailwindcss';

// Tokens canônicos definidos na Etapa 1 — Brand Guidelines & Design System.
// Não alterar valores base sem atualizar o documento de origem.
const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#050505',
        card: '#101010',
        glass: 'rgba(255,255,255,.05)',
        border: 'rgba(255,255,255,.08)',
        'text-primary': '#FFFFFF',
        'text-secondary': '#A1A1AA',
        'text-tertiary': '#71717A',
        accent: {
          green: '#22C55E',
          blue: '#3B82F6',
          purple: '#8B5CF6',
          red: '#EF4444',
        },
      },
      spacing: {
        'sp-1': '4px',
        'sp-2': '8px',
        'sp-3': '12px',
        'sp-4': '16px',
        'sp-5': '24px',
        'sp-6': '32px',
        'sp-7': '48px',
        'sp-8': '64px',
        'sp-9': '96px',
        'sp-10': '128px',
      },
      borderRadius: {
        // Escala de raio da Etapa 1 (nomeada r-sm..r-full na documentação).
        // Mapeada para as chaves padrão do Tailwind para evitar colisão com
        // as classes direcionais nativas (rounded-r-*, rounded-t-*, etc).
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        full: '999px',
      },
      boxShadow: {
        e1: '0 1px 2px rgba(0,0,0,.4)',
        e2: '0 2px 8px rgba(0,0,0,.45)',
        e3: '0 8px 24px rgba(0,0,0,.5)',
        e4: '0 16px 48px rgba(0,0,0,.55)',
        e5: '0 24px 64px rgba(0,0,0,.6)',
      },
      backdropBlur: {
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '40px',
      },
      transitionDuration: {
        fast: '150ms',
        base: '260ms',
        slow: '480ms',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(.16,1,.3,1)',
        spring: 'cubic-bezier(.34,1.56,.64,1)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'JetBrains Mono', 'monospace'],
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        // CONTROL OS — Etapa 8: "respiração lenta" do botão flutuante da
        // NOVA em estado ocioso — leve variação de escala/opacidade, nunca
        // brusca, pra comunicar presença viva sem chamar atenção demais.
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.9' },
          '50%': { transform: 'scale(1.06)', opacity: '1' },
        },
      },
      animation: {
        'fade-in': 'fade-in 260ms cubic-bezier(.16,1,.3,1)',
        'slide-up': 'slide-up 260ms cubic-bezier(.16,1,.3,1)',
        breathe: 'breathe 3200ms ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
