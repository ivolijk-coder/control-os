'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRoutePersona } from '@/lib/use-route-persona';
import { ICON_MAP } from './icon-map';
import { PersonaIdentityMark, type PersonaIdentity } from '@/components/nova/persona-identity-mark';

/**
 * MobileBottomNav — CONTROL OS: "otimização completa da experiência
 * mobile. Nesta versão Control Finance, a barra espelha a hierarquia da
 * sidebar e mantém apenas os destinos financeiros de uso mais frequente.
 *
 * Antes, mobile só tinha o drawer da Sidebar (hambúrguer no topo, ver
 * `Topbar`) — uma lista plana com os 12 destinos do produto, sem hierarquia
 * nenhuma entre eles, exigindo dois toques (abrir menu → escolher) e uma
 * mão alcançando o topo da tela pra qualquer navegação. Essa barra fixa no
 * rodapé coloca os 5 destinos de uso diário a UM toque do polegar, sempre
 * visíveis — "experiência pensada para uso com uma mão".
 *
 * "Todo o restante em segundo plano" não significa removido: Visão geral
 * (Dashboard), Documentos, Patrimônio, Viagens, Notas e Configurações
 * continuam exatamente onde sempre estiveram — no drawer da Sidebar, atrás
 * do botão de menu do `Topbar`. Só pararam de disputar espaço aqui embaixo
 * com o que o usuário realmente abre todo dia.
 *
 * Só existe abaixo de `md` (`md:hidden`). A opção IA abre o seletor de NOVA
 * ou LEGENDARY sem ocupar dois espaços da barra.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { effectivePersona, routePersona } = useRoutePersona();
  const [personaMenuOpen, setPersonaMenuOpen] = React.useState(false);

  const iaActive = routePersona !== undefined;

  function choosePersona(href: '/nova' | '/legendary') {
    setPersonaMenuOpen(false);
    router.push(href);
  }

  return (
    <>
      <AnimatePresence>
        {personaMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-x-4 z-40 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#090b10]/95 p-2 shadow-2xl backdrop-blur-xl md:hidden"
            style={{ bottom: 'calc(4.75rem + env(safe-area-inset-bottom))' }}
          >
            <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-tertiary">Escolha sua IA</p>
            <PersonaMenuOption persona="nova" active={effectivePersona === 'nova'} onClick={() => choosePersona('/nova')} />
            <PersonaMenuOption persona="legendary" active={effectivePersona === 'legendary'} onClick={() => choosePersona('/legendary')} />
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-white/[0.08] bg-bg/90 pb-[max(env(safe-area-inset-bottom),0.5rem)] backdrop-blur-xl md:hidden"
      >
        <button
          type="button"
          onClick={() => setPersonaMenuOpen((open) => !open)}
          aria-expanded={personaMenuOpen}
          aria-label="Escolher NOVA ou LEGENDARY"
          className={cn(
            'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors active:scale-95',
            iaActive ? effectivePersona === 'legendary' ? 'text-[#F4D889]' : 'text-accent-purple' : 'text-text-tertiary'
          )}
        >
          <span className="relative">
            <PersonaIdentityMark persona={effectivePersona} size={23} />
            <ChevronUp className={cn('absolute -right-3 -top-1 h-3 w-3 transition-transform', personaMenuOpen && 'rotate-180')} />
          </span>
          <span>IA</span>
        </button>
        <MobileNavLink href="/dashboard" label="Visão" Icon={ICON_MAP.LayoutGrid} active={pathname === '/dashboard'} />
        <MobileNavLink href="/financeiro" label="Financeiro" Icon={ICON_MAP.Wallet} active={pathname?.startsWith('/financeiro') ?? false} />
        <MobileNavLink href="/relatorios" label="Relatórios" Icon={ICON_MAP.BarChart3} active={pathname?.startsWith('/relatorios') ?? false} />
        <MobileNavLink href="/documentos" label="Documentos" Icon={ICON_MAP.FileText} active={pathname?.startsWith('/documentos') ?? false} />
      </nav>
    </>
  );
}

function PersonaMenuOption({ persona, active, onClick }: { persona: PersonaIdentity; active: boolean; onClick: () => void }) {
  const legendary = persona === 'legendary';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors', active ? legendary ? 'bg-[#ff8d20]/10' : 'bg-[#0c96ff]/10' : 'hover:bg-white/[0.05]')}
    >
      <PersonaIdentityMark persona={persona} size={34} />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-xs font-semibold tracking-[0.14em]', legendary ? 'text-[#ffd770]' : 'text-[#53ccff]')}>{legendary ? 'LEGENDARY' : 'NOVA'}</span>
        <span className="mt-0.5 block text-[11px] text-text-tertiary">{legendary ? 'Mentor estratégico' : 'Inteligência operacional'}</span>
      </span>
      {active && <Check className={cn('h-4 w-4', legendary ? 'text-[#ff9a22]' : 'text-[#20bfff]')} strokeWidth={3} />}
    </button>
  );
}

function MobileNavLink({
  href,
  label,
  Icon,
  persona,
  active,
  accent = 'purple',
}: {
  href: string;
  label: string;
  Icon?: LucideIcon;
  persona?: PersonaIdentity;
  active: boolean;
  accent?: 'purple' | 'gold';
}) {
  return (
    <Link
      href={href}
      // `py-2` + ícone de 20px + rótulo + gap somam ~56px de altura de
      // toque — acima do mínimo de 44pt recomendado (Apple HIG) mesmo antes
      // da folga extra de `safe-area-inset-bottom` do `<nav>` pai.
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors duration-fast ease-out active:scale-95',
        active
          ? accent === 'gold'
            ? 'text-[#F4D889]'
            : 'text-accent-purple'
          : 'text-text-tertiary hover:text-text-secondary'
      )}
    >
      {persona ? <PersonaIdentityMark persona={persona} size={21} /> : Icon ? <Icon className="h-5 w-5" /> : null}
      <span className="truncate">{label}</span>
    </Link>
  );
}
