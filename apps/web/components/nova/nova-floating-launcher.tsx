'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { hoverLift, transitionOut, transitionSpring } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { PersonaIdentityMark, type PersonaIdentity } from '@/components/nova/persona-identity-mark';

type Persona = PersonaIdentity;

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
        className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#050608]/95 p-0 shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur-md"
        {...hoverLift}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={transitionOut(0.3)}
      >
        <PersonaIdentityMark persona={activePersona} size={60} />
      </motion.button>
    </div>
  );
}
