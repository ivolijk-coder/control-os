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
          // CONTROL OS — Etapa 15 (LEGENDARY): dourado/âmbar — identidade
          // visual própria da segunda inteligência ("elegância, calma,
          // sabedoria"), aditivo à paleta existente (roxo/azul continuam a
          // identidade da NOVA, intocados).
          gold: '#D9A455',
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
        // CONTROL OS — Etapa 10A: glow colorido e discreto para hover de
        // cards/botões premium — sempre combinado com uma sombra e1/e2 de
        // base (nunca substitui a elevação, só adiciona um halo de cor).
        'glow-purple': '0 0 0 1px rgba(139,92,246,.16), 0 8px 32px rgba(139,92,246,.18)',
        'glow-blue': '0 0 0 1px rgba(59,130,246,.16), 0 8px 32px rgba(59,130,246,.18)',
        // CONTROL OS — Etapa 15 (LEGENDARY) — mesmo padrão de glow-purple/-blue.
        'glow-gold': '0 0 0 1px rgba(217,164,85,.18), 0 8px 32px rgba(217,164,85,.2)',
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
      // CONTROL OS — Etapa 10A: "remover preto chapado, criar profundidade,
      // gradientes extremamente suaves, glow discreto, sensação de
      // ambiente". Duas manchas radiais bem sutis (intensidade baixa,
      // nunca poluir) — aplicado sobre `bg-bg` (cor sólida continua como
      // base/fallback), nunca no lugar dela.
      backgroundImage: {
        'ambient-glow':
          'radial-gradient(ellipse 140% 70% at 12% -10%, rgba(139,92,246,0.14), transparent 60%), radial-gradient(ellipse 120% 60% at 100% 110%, rgba(59,130,246,0.10), transparent 60%)',
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
        // CONTROL OS — Etapa 10A: deriva quase imperceptível do glow de
        // fundo — "sensação de ambiente", nunca uma animação chamativa.
        // Sempre usado com o variant `motion-safe:` (Tailwind já respeita
        // `prefers-reduced-motion` nesse variant, sem precisar de JS).
        'ambient-drift': {
          '0%, 100%': { backgroundPosition: '0% 0%, 100% 100%' },
          '50%': { backgroundPosition: '2% 1%, 98% 99%' },
        },
      },
      animation: {
        'fade-in': 'fade-in 260ms cubic-bezier(.16,1,.3,1)',
        'slide-up': 'slide-up 260ms cubic-bezier(.16,1,.3,1)',
        breathe: 'breathe 3200ms ease-in-out infinite',
        'ambient-drift': 'ambient-drift 24000ms ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
