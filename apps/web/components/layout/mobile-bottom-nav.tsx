'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
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
 * rodapé coloca os destinos de uso diário a UM toque do polegar, sempre
 * visíveis — "experiência pensada para uso com uma mão".
 *
 * "Todo o restante em segundo plano" não significa removido: Visão geral
 * (Dashboard), Documentos, Patrimônio, Viagens, Notas e Configurações
 * continuam exatamente onde sempre estiveram — no drawer da Sidebar, atrás
 * do botão de menu do `Topbar`. Só pararam de disputar espaço aqui embaixo
 * com o que o usuário realmente abre todo dia.
 *
 * Só existe abaixo de `md` (`md:hidden`).
 *
 * ── Identidade visual (esta etapa) ────────────────────────────────────────
 *
 * A marca da persona SEMPRE esteve aqui, mas no lugar errado: 23px, no
 * primeiro de cinco espaços de peso igual, com o rótulo genérico "IA" — o
 * canto de MENOR alcance do polegar, disputando atenção com "Documentos".
 * Agora ela é o ponto de acesso central e elevado, no eixo confortável do
 * polegar, com halo na cor da persona ativa e SEM rótulo: a marca oficial
 * (`/personas/*.png`, via `PersonaIdentityMark`) se explica sozinha, do
 * mesmo jeito que já acontece no outro produto da casa.
 *
 * O QUE NÃO MUDOU, de propósito: o comportamento. Um toque no orb continua
 * abrindo/fechando exatamente a mesma folha de seleção de persona que o
 * botão "IA" abria, com o mesmo estado, os mesmos destinos (`/nova`,
 * `/legendary`) e os mesmos atributos de acessibilidade. Esta etapa é
 * posicionamento e pintura — nenhuma regra nova de navegação.
 *
 * O acento ativo dos destinos passou de roxo para `accent-blue`: a marca
 * oficial da NOVA (`nova-launcher-c-clean.png`) é azul, e este arquivo já
 * usava azul (`#0c96ff`/`#53ccff`/`#20bfff`) no seletor de persona. O roxo
 * aqui era o único ponto que contrariava a própria marca.
 */

/** Altura do orb elevado e o quanto ele sobe acima da barra, em px. */
const ORB_SIZE = 56;
const ORB_LIFT = 27;
const ORB_MARK_SIZE = 46;

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { effectivePersona, routePersona } = useRoutePersona();
  const [personaMenuOpen, setPersonaMenuOpen] = React.useState(false);

  const iaActive = routePersona !== undefined;
  const legendary = effectivePersona === 'legendary';

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
            className="fixed inset-x-4 z-40 overflow-hidden rounded-2xl border border-nav-line/[0.1] bg-nav-raised/95 p-2 shadow-2xl backdrop-blur-xl md:hidden"
            // Sobe a partir do orb, não do canto: precisa limpar a altura da
            // barra + o quanto o orb se eleva acima dela + a safe area.
            style={{ bottom: 'calc(6.25rem + env(safe-area-inset-bottom))' }}
          >
            <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-nav-3">Escolha sua IA</p>
            <PersonaMenuOption persona="nova" active={effectivePersona === 'nova'} onClick={() => choosePersona('/nova')} />
            <PersonaMenuOption persona="legendary" active={effectivePersona === 'legendary'} onClick={() => choosePersona('/legendary')} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Envelope só de posicionamento: `pointer-events-none` para que a
          faixa vazia ao lado da pílula não capture toques que pertencem ao
          conteúdo da página. A pílula reativa os eventos. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-3 md:hidden"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
      >
        <nav
          aria-label="Navegação principal"
          className="pointer-events-auto relative flex items-center justify-around rounded-[26px] border border-nav-line/[0.08] bg-nav/95 px-1 py-2 shadow-e3-glass backdrop-blur-xl"
        >
          <MobileNavLink href="/dashboard" label="Visão" Icon={ICON_MAP.LayoutGrid} active={pathname === '/dashboard'} />
          <MobileNavLink href="/financeiro" label="Financeiro" Icon={ICON_MAP.Wallet} active={pathname?.startsWith('/financeiro') ?? false} />

          {/* Espaço reservado do orb — mantém os quatro destinos equilibrados,
              dois de cada lado, sem que nenhum passe por baixo da marca. */}
          <div className="relative flex min-w-0 flex-1 justify-center" style={{ height: 44 }}>
            <button
              type="button"
              onClick={() => setPersonaMenuOpen((open) => !open)}
              aria-expanded={personaMenuOpen}
              aria-label={`Escolher NOVA ou LEGENDARY (ativa: ${legendary ? 'LEGENDARY' : 'NOVA'})`}
              className={cn(
                'absolute grid place-items-center rounded-full bg-nav shadow-e3 transition-transform duration-fast ease-out active:scale-95',
                // O botão antigo não tinha estilo de foco visível — só o
                // outline padrão do navegador, que some contra o fundo
                // escuro. Aditivo: não muda nada no toque.
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-nav',
                legendary ? 'focus-visible:ring-accent-gold' : 'focus-visible:ring-nav-active'
              )}
              style={{ width: ORB_SIZE, height: ORB_SIZE, top: -ORB_LIFT }}
            >
              {/* Halo da persona ativa. `aria-hidden` implícito: é um span
                  decorativo sem conteúdo, fora do fluxo de leitura. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-3 rounded-full blur-[3px]"
                style={{
                  background: `radial-gradient(circle, ${legendary ? 'rgba(217,164,85,0.42)' : 'rgba(59,130,246,0.42)'} 0%, transparent 68%)`,
                }}
              />
              <PersonaIdentityMark persona={effectivePersona} size={ORB_MARK_SIZE} className="relative" />
            </button>
          </div>

          <MobileNavLink href="/relatorios" label="Relatórios" Icon={ICON_MAP.BarChart3} active={pathname?.startsWith('/relatorios') ?? false} />
          <MobileNavLink href="/documentos" label="Documentos" Icon={ICON_MAP.FileText} active={pathname?.startsWith('/documentos') ?? false} />

          {/* Indicador de que a IA é a tela atual — a marca já carrega a cor
              da persona, então aqui basta um traço discreto sob o orb, no
              lugar do rótulo "IA" que existia antes. */}
          {iaActive && (
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute bottom-1.5 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full',
                legendary ? 'bg-accent-gold' : 'bg-nav-active'
              )}
            />
          )}
        </nav>
      </div>
    </>
  );
}

function PersonaMenuOption({ persona, active, onClick }: { persona: PersonaIdentity; active: boolean; onClick: () => void }) {
  const legendary = persona === 'legendary';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors', active ? legendary ? 'bg-accent-gold/10' : 'bg-nav-active/10' : 'hover:bg-nav-line/[0.05]')}
    >
      <PersonaIdentityMark persona={persona} size={34} />
      <span className="min-w-0 flex-1">
        <span className={cn('block text-xs font-semibold tracking-[0.14em]', legendary ? 'text-[#ffd770]' : 'text-[#53ccff]')}>{legendary ? 'LEGENDARY' : 'NOVA'}</span>
        <span className="mt-0.5 block text-[11px] text-nav-3">{legendary ? 'Mentor estratégico' : 'Inteligência operacional'}</span>
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
  accent = 'blue',
}: {
  href: string;
  label: string;
  Icon?: LucideIcon;
  persona?: PersonaIdentity;
  active: boolean;
  accent?: 'blue' | 'gold';
}) {
  return (
    <Link
      href={href}
      // `py-2` + ícone de 20px + rótulo + gap somam ~56px de altura de
      // toque — acima do mínimo de 44pt recomendado (Apple HIG) mesmo antes
      // da folga extra de `safe-area-inset-bottom` do envelope pai.
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors duration-fast ease-out active:scale-95',
        active
          ? accent === 'gold'
            ? 'text-accent-gold'
            : 'text-nav-active'
          : 'text-nav-3 hover:text-nav-2'
      )}
    >
      {persona ? <PersonaIdentityMark persona={persona} size={21} /> : Icon ? <Icon className="h-5 w-5" /> : null}
      <span className="truncate">{label}</span>
    </Link>
  );
}
