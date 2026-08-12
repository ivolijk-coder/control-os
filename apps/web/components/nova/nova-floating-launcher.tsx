'use client';

import * as React from 'react';
import Image from 'next/image';
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

/**
 * Acesso global e reconhecível às duas inteligências do CONTROL OS.
 *
 * Este é o ÚNICO caminho para a LEGENDARY no computador — a barra lateral
 * lista `/nova`, mas não `/legendary` (ver `MOCK_NAV_ITEMS`). Por isso ele
 * não pode simplesmente deixar de existir: sumir com ele deixaria a
 * LEGENDARY inalcançável fora do celular.
 *
 * ── Acabamento desta etapa ────────────────────────────────────────────────
 *
 * Ele estava com 72px em `bottom-6 right-6`, ocupando 96px de canto — o
 * bastante para cair em cima do compositor do painel de conversa do
 * dashboard. Agora tem 56px (o mesmo tamanho do orb central do celular, que
 * é a mesma marca no mesmo papel) e sobe para `bottom-8`, saindo da faixa
 * onde o compositor termina.
 *
 * Isto REDUZ a colisão, não a elimina: um elemento fixo sempre passa por
 * cima de algo enquanto a página rola. A eliminação completa exigiria mover
 * a escolha de persona para dentro da casca, e essa é uma decisão de
 * navegação, não de pintura.
 *
 * As cores cruas saíram: o fundo do menu vira `nav-raised` e o fundo do
 * botão vira `nav` — a mesma família que a sidebar, a barra de topo e o orb
 * do celular já usam, escura nos dois temas por construção.
 */
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
    <div ref={containerRef} className="fixed bottom-8 right-6 z-30 hidden flex-col items-end gap-3 md:flex">
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Escolher inteligência do CONTROL OS"
            initial={{ opacity: 0, scale: 0.94, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={transitionSpring}
            // Opaco, não `/95`. Vidro só funciona quando o que está atrás é
            // escuro: sobre conteúdo claro, 5% da página vazando para dentro
            // da casca sobe a superfície de #141a23 para ~#1f252e e derruba
            // `nav-3` de 4.55:1 para 4.01:1 — reprova. No escuro a diferença
            // entre opaco e 95% é imperceptível, então não se perde nada.
            className="w-72 overflow-hidden rounded-[22px] border border-nav-line/[0.1] bg-nav-raised p-2 shadow-e5-glass"
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
                      // `tint` é ardósia no tema claro — errado aqui, porque
                      // este menu é casca escura nos DOIS temas. `nav-line`
                      // é a família certa, a mesma do menu do celular.
                      : 'hover:bg-nav-line/[0.05]'
                  )}
                >
                  <span className={cn('absolute bottom-3 left-0 top-3 w-0.5 rounded-full transition-opacity', active ? 'opacity-100' : 'opacity-0', isLegendary ? 'bg-[#ff8d20]' : 'bg-[#22b8ff]')} />
                  <PersonaIdentityMark persona={option.persona} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-xs font-semibold tracking-[0.14em]', isLegendary ? 'text-[#ffd770]' : 'text-[#53ccff]')}>
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-nav-3">{option.subtitle}</span>
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
        // 72px → 56px (o mesmo do orb central do celular) e a sombra passa
        // a vir do token: um halo preto a 64% embaixo de um círculo escuro
        // não é elevação sobre papel branco, é sujeira.
        className="relative flex h-14 w-14 items-center justify-center overflow-visible rounded-full bg-nav p-0 shadow-e4"
        {...hoverLift}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={transitionOut(0.3)}
      >
        {activePersona === 'nova' ? (
          <Image src="/personas/nova-launcher-c-clean.png" alt="NOVA" width={56} height={56} priority className="relative h-full w-full scale-[0.91] rounded-full object-cover" />
        ) : (
          <Image src="/personas/legendary-launcher-c.png" alt="LEGENDARY" width={56} height={56} priority className="relative h-full w-full scale-[0.91] rounded-full object-cover" />
        )}
      </motion.button>
    </div>
  );
}
