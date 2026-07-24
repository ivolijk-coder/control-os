'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { hoverLift, transitionOut, transitionSpring } from '@/lib/motion';
import { cn } from '@/lib/utils';

type Persona = 'nova' | 'legendary';

interface EnvironmentOption {
  href: '/nova' | '/legendary';
  label: string;
  subtitle: string;
  persona: Persona;
}

const ENVIRONMENT_OPTIONS: readonly EnvironmentOption[] = [
  { href: '/nova', label: 'NOVA', subtitle: 'Inteligência operacional', persona: 'nova' },
  { href: '/legendary', label: 'LEGENDARY', subtitle: 'Mentor estratégico', persona: 'legendary' },
];

/**
 * Marca reduzida das inteligências: a mesma família de anel aberto e ponto
 * para as duas personas. NOVA é energia fria; LEGENDARY é ouro incandescente.
 * O halo gira devagar para comunicar presença, mas respeita reduced motion.
 */
function PersonaIdentityMark({ persona, size }: { persona: Persona; size: number }) {
  const rawId = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const reduceMotion = useReducedMotion();
  const isLegendary = persona === 'legendary';
  const colors = isLegendary
    ? { dim: '#9a3f08', base: '#ff9a22', bright: '#ffe39a', glow: 'rgba(255, 124, 24, 0.62)' }
    : { dim: '#313dff', base: '#16b8ff', bright: '#d8f5ff', glow: 'rgba(38, 168, 255, 0.6)' };
  const gradientId = `persona-mark-${persona}-${rawId}`;

  return (
    <span aria-hidden="true" className="relative block shrink-0" style={{ width: size, height: size }}>
      {/* Luz orbital: uma volta lenta, discreta e sempre dentro da família da marca. */}
      <motion.span
        className="absolute -inset-1 rounded-full"
        style={{
          background: `conic-gradient(from 12deg, transparent 0deg, transparent 110deg, ${colors.bright} 155deg, ${colors.base} 190deg, transparent 235deg, transparent 360deg)`,
          filter: `blur(${Math.max(2, size * 0.055)}px)`,
          opacity: 0.85,
        }}
        animate={reduceMotion ? undefined : { rotate: 360 }}
        transition={{ duration: isLegendary ? 8.8 : 7.2, repeat: Infinity, ease: 'linear' }}
      />
      <span className="absolute inset-0 rounded-full border border-white/[0.12] bg-[#080b10]" />
      <svg className="absolute inset-[11%] overflow-visible" viewBox="0 0 100 100" fill="none">
        <defs>
          <linearGradient id={gradientId} x1="18" y1="78" x2="77" y2="18" gradientUnits="userSpaceOnUse">
            <stop stopColor={colors.dim} />
            <stop offset="0.5" stopColor={colors.base} />
            <stop offset="0.8" stopColor={colors.bright} />
            <stop offset="1" stopColor={colors.base} />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="31" stroke={`url(#${gradientId})`} strokeWidth="10" strokeLinecap="round" strokeDasharray="166 38" transform="rotate(-54 50 50)" />
        <circle cx="72" cy="28" r="7.2" fill={colors.base} style={{ filter: `drop-shadow(0 0 5px ${colors.glow})` }} />
      </svg>
    </span>
  );
}

/** Acesso global e reconhecível às duas inteligências do CONTROL OS. */
export function NovaFloatingLauncher() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const activeHref: EnvironmentOption['href'] = pathname?.startsWith('/legendary') ? '/legendary' : '/nova';
  const activePersona: Persona = activeHref === '/legendary' ? 'legendary' : 'nova';

  React.useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function handleSelect(href: EnvironmentOption['href']) {
    setOpen(false);
    router.push(href);
  }

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-30 hidden flex-col items-end gap-3 md:flex">
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Escolher inteligência do CONTROL OS"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={transitionSpring}
            className="w-72 overflow-hidden rounded-[22px] border border-white/[0.1] bg-[#0b0e13]/95 p-2 shadow-e5-glass backdrop-blur-xl"
          >
            {ENVIRONMENT_OPTIONS.map((option) => {
              const active = option.href === activeHref;
              const isLegendary = option.persona === 'legendary';
              return (
                <button
                  key={option.href}
                  type="button"
                  role="menuitem"
                  onClick={() => handleSelect(option.href)}
                  className={cn(
                    'group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 text-left transition-all duration-fast ease-out',
                    active
                      ? isLegendary
                        ? 'bg-[linear-gradient(105deg,rgba(255,119,19,0.14),rgba(255,184,65,0.045))]'
                        : 'bg-[linear-gradient(105deg,rgba(12,150,255,0.16),rgba(70,92,255,0.04))]'
                      : 'hover:bg-white/[0.05]'
                  )}
                >
                  <span className={cn('absolute bottom-3 left-0 top-3 w-0.5 rounded-full transition-opacity', active ? 'opacity-100' : 'opacity-0', isLegendary ? 'bg-[#ff8d20]' : 'bg-[#22b8ff]')} />
                  <PersonaIdentityMark persona={option.persona} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-xs font-semibold tracking-[0.14em]', isLegendary ? 'text-[#ffd770]' : 'text-[#53ccff]')}>
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-text-tertiary">{option.subtitle}</span>
                  </span>
                  {active && (
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-full', isLegendary ? 'bg-[#ff9a22] text-[#241004]' : 'bg-[#20bfff] text-[#04121c]')}>
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Acessar NOVA ou LEGENDARY"
        className="relative flex h-[62px] w-[62px] items-center justify-center rounded-full border border-white/[0.12] bg-[#080b10]/95 p-2 shadow-e5 backdrop-blur-md"
        {...hoverLift}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={transitionOut(0.3)}
      >
        <PersonaIdentityMark persona={activePersona} size={46} />
      </motion.button>
    </div>
  );
}
