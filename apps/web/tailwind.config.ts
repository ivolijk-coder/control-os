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
        bg: 'rgb(var(--bg-rgb) / <alpha-value>)',
        card: 'rgb(var(--card-rgb) / <alpha-value>)',
        glass: 'rgb(var(--glass-rgb) / <alpha-value>)',
        border: 'rgb(var(--border-rgb) / <alpha-value>)',
        'text-primary': 'rgb(var(--text-primary-rgb) / <alpha-value>)',
        'text-secondary': 'rgb(var(--text-secondary-rgb) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--text-tertiary-rgb) / <alpha-value>)',
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
          // CONTROL OS — Etapa 16A (Design System premium — extração da
          // referência visual): tom dourado mais claro/quente, mesma família
          // de `gold` — usado em badges/destaques secundários da LEGENDARY,
          // igual a `blue` já ser a variação secundária de `purple` na NOVA
          // (ver `PERSONA_LISTENING_GLOW_RGB.legendary` em `nova-orb.tsx`,
          // mesmo valor). Aditivo — `gold` continua o tom primário.
          'gold-soft': '#EBC78A',
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
        // CONTROL OS — Etapa 16D (Design System premium — biblioteca de
        // componentes): variantes "vidro" de e3/e5 — mesma elevação de
        // sempre, com uma linha de luz de 1px no topo por dentro (`inset`),
        // igual ao tratamento já aplicado na Sidebar/Topbar/busca na Etapa
        // 16C. Usado por `Card`/`GlassCard` (praticamente toda tela do
        // produto) e pelo `FloatingPanel` (Command Center e futuros modais)
        // — dá a MESMA "espessura de vidro" pra toda superfície elevada do
        // sistema, não só o chrome de navegação. Aditivo — `e3`/`e5`
        // continuam intocados para quem ainda os usa diretamente.
        'e3-glass': '0 8px 24px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.05)',
        'e5-glass': '0 24px 64px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.06)',
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
      // CONTROL OS — Etapa 16A: rastro extremamente aberto para eyebrows/
      // labels em caixa alta ("NOVA EM AÇÃO", "FALANDO COM LEGENDARY") — o
      // traço mais reconhecível da referência de luxo/tecnologia analisada.
      // Aditivo à escala padrão do Tailwind (`tracking-tight`/`-wide`/etc
      // continuam intocados) — usar via `tracking-eyebrow`.
      letterSpacing: {
        eyebrow: '0.22em',
      },
      // CONTROL OS — Etapa 10A: "remover preto chapado, criar profundidade,
      // gradientes extremamente suaves, glow discreto, sensação de
      // ambiente". Duas manchas radiais bem sutis (intensidade baixa,
      // nunca poluir) — aplicado sobre `bg-bg` (cor sólida continua como
      // base/fallback), nunca no lugar dela.
      backgroundImage: {
        'ambient-glow':
          'radial-gradient(ellipse 140% 70% at 12% -10%, rgba(139,92,246,0.14), transparent 60%), radial-gradient(ellipse 120% 60% at 100% 110%, rgba(59,130,246,0.10), transparent 60%)',
        // CONTROL OS — Etapa 16F (Art Direction — Orb como coração do
        // sistema): variante dourada do mesmo par de manchas radiais acima —
        // antes o fundo do produto INTEIRO (toda página autenticada, não só
        // `/nova`) ficava sempre roxo/azul, mesmo com a LEGENDARY ativa.
        // Mesma posição/intensidade/forma, só a cor troca — "a luz da Orb
        // influencia discretamente o ambiente" só é verdade se o ambiente de
        // fato mudar de cor junto com ela.
        'ambient-glow-gold':
          'radial-gradient(ellipse 140% 70% at 12% -10%, rgba(217,164,85,0.14), transparent 60%), radial-gradient(ellipse 120% 60% at 100% 110%, rgba(235,199,138,0.10), transparent 60%)',
        // CONTROL OS — Etapa 16A: "disco de luz no chão sob o objeto 3D,
        // como spot de vitrine" — o padrão de apresentação da NovaOrb/futuro
        // cristal da LEGENDARY como um objeto exposto, nunca só "flutuando
        // no vazio". Uma elipse achatada e bem baixa (nunca um círculo),
        // pensada pra ficar atrás/abaixo do objeto hero, nunca no lugar do
        // halo dele. Duas variantes (roxo/dourado) — mesmo par de cores já
        // usado no resto da identidade de cada persona.
        'pedestal-glow-purple': 'radial-gradient(ellipse 60% 100% at 50% 50%, rgba(139,92,246,0.35), transparent 70%)',
        'pedestal-glow-gold': 'radial-gradient(ellipse 60% 100% at 50% 50%, rgba(217,164,85,0.35), transparent 70%)',
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
        // CONTROL OS — Etapa 16D: "loading states... nunca tela parada" —
        // `Skeleton` tinha só um `animate-pulse` genérico do Tailwind
        // (opacidade subindo/descendo uniformemente). Um brilho diagonal
        // varrendo o bloco da esquerda pra direita é o padrão de loading
        // "premium" reconhecível da referência — sensação de luz passando
        // por vidro, não um retângulo cinza pulsando.
        shimmer: {
          '0%': { backgroundPosition: '-150% 0' },
          '100%': { backgroundPosition: '150% 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 260ms cubic-bezier(.16,1,.3,1)',
        'slide-up': 'slide-up 260ms cubic-bezier(.16,1,.3,1)',
        breathe: 'breathe 3200ms ease-in-out infinite',
        'ambient-drift': 'ambient-drift 24000ms ease-in-out infinite',
        shimmer: 'shimmer 1800ms ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
