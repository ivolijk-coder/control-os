'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { hoverLift, transitionOut, transitionSpring } from '@/lib/motion';
import { NovaRingObject } from '@/components/nova/nova-ring-object';
import { LegendaryCrystalObject } from '@/components/nova/legendary-crystal-object';
import { cn } from '@/lib/utils';

interface EnvironmentOption {
  href: '/nova' | '/legendary';
  label: string;
  subtitle: string;
}

const ENVIRONMENT_OPTIONS: readonly EnvironmentOption[] = [
  { href: '/nova', label: 'NOVA', subtitle: 'Inteligência Operacional' },
  { href: '/legendary', label: 'LEGENDARY', subtitle: 'Mentor Estratégico' },
];

/**
 * NovaFloatingLauncher — acesso global às duas inteligências do CONTROL OS.
 *
 * Redefinido por completo (antes: botão único que abria o Modo Conversa
 * por voz da NOVA em tela cheia, `NovaVoiceOverlay` — essa era a ÚNICA
 * forma de abrir aquele modo; com a mudança abaixo ele fica sem gatilho
 * na interface. Voz continua existindo no dia a dia via o microfone
 * inline do `NovaInput`, já dentro de `/nova`/`/legendary` — Etapa 11C —
 * só o atalho de "voz em tela cheia instantânea de qualquer lugar" que
 * some; decisão explícita do usuário pra este botão, não um descuido).
 *
 * Em repouso, sempre mostra a identidade oficial da NOVA (`NovaRingObject`,
 * o MESMO objeto/cores/animação da página `/nova` — nunca uma esfera
 * separada). Ao clicar, não abre um chat diretamente — abre um popover
 * pequeno com as duas opções (NOVA azul / LEGENDARY dourado), cada uma
 * com sua própria identidade visual. Selecionar uma opção NAVEGA para o
 * ambiente daquela inteligência (`/nova` ou `/legendary`) — dois módulos
 * fixos e independentes, não mais um toggle de modelo dentro da mesma
 * tela (ver `nova-workspace.tsx`, prop `lockedPersona`).
 *
 * Visível em QUALQUER página, inclusive `/nova` e `/legendary` — antes o
 * botão se escondia nessas rotas (a lógica antiga evitava empilhar duas
 * superfícies de CONVERSA uma sobre a outra); agora o botão não abre mais
 * uma conversa por conta própria, é só um menu de navegação, então faz
 * sentido continuar disponível mesmo dentro de um dos dois ambientes —
 * é o jeito mais rápido de pular de um para o outro.
 */
export function NovaFloatingLauncher() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
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
    // CONTROL OS — "otimização completa da experiência mobile": abaixo de
    // `md` este botão redondo somava com a nova `MobileBottomNav` (barra
    // inferior de largura cheia, ver `mobile-bottom-nav.tsx`) — dois alvos
    // de toque flutuantes disputando o mesmo canto do polegar. A aba "IA"
    // da barra inferior já cobre exatamente este atalho (abre o ambiente da
    // persona ativa); trocar de NOVA para LEGENDARY (ou vice-versa) no
    // mobile continua possível pelo drawer da Sidebar (`nav_nova`/
    // `nav_legendary` já existem lá — nenhuma capacidade perdida). Desktop/
    // tablet (`md:flex`) continuam exatamente como sempre foram.
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
            className="w-64 overflow-hidden rounded-2xl border border-white/[0.08] bg-card/90 p-2 shadow-e5-glass backdrop-blur-xl"
          >
            {ENVIRONMENT_OPTIONS.map((option) => (
              <button
                key={option.href}
                type="button"
                role="menuitem"
                onClick={() => handleSelect(option.href)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-fast ease-out hover:bg-white/[0.05]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center">
                  {option.href === '/nova' ? <NovaRingObject size={30} /> : <LegendaryCrystalObject size={22} />}
                </span>
                <span className="flex flex-col">
                  <span
                    className={cn(
                      'text-xs font-semibold tracking-wide',
                      option.href === '/nova' ? 'text-[#4FD8FF]' : 'text-[#F4D889]'
                    )}
                  >
                    {option.label}
                  </span>
                  <span className="text-[11px] text-text-tertiary">{option.subtitle}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Acessar NOVA ou LEGENDARY"
        className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#0a0b0d]/90 shadow-e5 backdrop-blur-md"
        {...hoverLift}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={transitionOut(0.3)}
      >
        <NovaRingObject size={40} />
      </motion.button>
    </div>
  );
}
