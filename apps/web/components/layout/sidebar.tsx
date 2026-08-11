'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { useMediaQuery } from '@control-os/hooks';
import { Avatar, AvatarFallback } from '@control-os/ui';
import { cn, getInitials } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import type { NavItem } from '@control-os/types';
import { MOCK_NAV_ITEMS } from '@/lib/mock-data';
import { useAccount } from '@/lib/use-account';
import { ICON_MAP } from './icon-map';
import { PersonaIdentityMark } from '@/components/nova/persona-identity-mark';

const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)';

const FINANCE_ITEM_IDS = new Set([
  'nav_financeiro_dashboard',
  'nav_financeiro_contas',
  'nav_financeiro_categorias',
  'nav_financeiro_transacoes',
  'nav_financeiro_nova_transacao',
  'nav_financeiro_contas_fixas',
  'nav_financeiro_contas_do_mes',
  'nav_financeiro_cartoes',
  'nav_financeiro_parcelamentos',
  'nav_financeiro_metas',
]);

function itemIsActive(item: NavItem, pathname: string | null): boolean {
  if (!pathname) return false;
  if (item.href === '/financeiro' || item.href === '/financeiro/transacoes') return pathname === item.href;
  return pathname.startsWith(item.href);
}

function NavLink({ item, pathname, collapsed, nested = false }: {
  item: NavItem;
  pathname: string | null;
  collapsed: boolean;
  nested?: boolean;
}) {
  const Icon = ICON_MAP[item.icon];
  const active = itemIsActive(item, pathname);

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex min-h-10 items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors duration-150 ease-out',
        nested && !collapsed && 'ml-2 pl-5 text-[13px]',
        active
          ? 'bg-nav-active/[0.14] text-nav-1'
          : 'text-nav-2 hover:bg-nav-line/[0.05] hover:text-nav-1'
      )}
    >
      {active && <span className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-nav-active" />}
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-nav-active' : 'text-nav-3 group-hover:text-nav-2')} />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
    </Link>
  );
}

function FinanceNavGroup({ items, pathname, collapsed }: { items: NavItem[]; pathname: string | null; collapsed: boolean }) {
  const routeIsInFinance = pathname?.startsWith('/financeiro') ?? false;
  const [open, setOpen] = React.useState(routeIsInFinance);

  React.useEffect(() => {
    if (routeIsInFinance) setOpen(true);
  }, [routeIsInFinance]);

  return (
    <section className="mt-3" aria-label="Financeiro">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        title={collapsed ? 'Financeiro' : undefined}
        aria-expanded={open}
        className={cn(
          'flex min-h-9 w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors duration-150 ease-out hover:bg-nav-line/[0.05] hover:text-nav-1',
          routeIsInFinance ? 'text-nav-1' : 'text-nav-3'
        )}
      >
        <ICON_MAP.Wallet className={cn('h-4 w-4 shrink-0', routeIsInFinance ? 'text-nav-active' : 'text-nav-3')} />
        {!collapsed && (
          <>
            <span className="flex-1 text-[10px] font-semibold uppercase tracking-[0.16em]">Financeiro</span>
            <ChevronDown className={cn('h-3.5 w-3.5 text-nav-3 transition-transform duration-150', open && 'rotate-180')} />
          </>
        )}
      </button>
      <AnimatePresence initial={false}>
        {(open || collapsed) && (
          <motion.div
            initial={collapsed ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className={cn('mt-1 flex flex-col gap-0.5', !collapsed && 'border-l border-nav-line/[0.07]') }>
              {items.map((item) => <NavLink key={item.id} item={item} pathname={pathname} collapsed={collapsed} nested />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/** Navegação do Control Finance. Itens antigos permanecem acessíveis por URL, mas não aparecem aqui. */
export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const mobileNavOpen = useAppStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen);
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT_QUERY);
  const effectiveCollapsed = isMobile ? false : collapsed;
  const account = useAccount();

  const financeItems = React.useMemo(() => MOCK_NAV_ITEMS.filter((item) => FINANCE_ITEM_IDS.has(item.id)), []);
  const mainItems = React.useMemo(() => MOCK_NAV_ITEMS.filter((item) => !FINANCE_ITEM_IDS.has(item.id)), []);

  React.useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname, setMobileNavOpen]);

  return (
    <>
      {isMobile && (
        <AnimatePresence>
          {mobileNavOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileNavOpen(false)} className="fixed inset-0 z-40 bg-[#05070c]/60 backdrop-blur-sm" aria-hidden />}
        </AnimatePresence>
      )}

      <motion.aside
        initial={false}
        animate={isMobile ? { x: mobileNavOpen ? 0 : '-100%', width: 280 } : { x: 0, width: collapsed ? 76 : 264 }}
        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className={cn('control-sidebar flex h-screen flex-col border-r border-nav-line/[0.075] bg-nav backdrop-blur-xl', isMobile ? 'fixed inset-y-0 left-0 z-50 shadow-e5' : 'relative')}
      >
        <div className="flex h-16 items-center gap-3 px-5">
          <Link href="/dashboard" title={effectiveCollapsed ? 'Control Finance' : undefined} className="group flex min-w-0 flex-1 items-center gap-3">
            <PersonaIdentityMark size={32} className="transition-transform duration-150 group-hover:scale-105" />
            {!effectiveCollapsed && <span className="truncate text-sm font-semibold tracking-tight text-nav-1">CONTROL FINANCE</span>}
          </Link>
          {isMobile && <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Fechar menu" className="flex h-9 w-9 items-center justify-center rounded-md text-nav-3 hover:bg-nav-line/[0.06] hover:text-nav-1"><ICON_MAP.ChevronsLeft className="h-4 w-4" /></button>}
        </div>
        <div className="h-px w-full shrink-0 bg-nav-line/[0.075]" />

        <nav className="flex flex-1 flex-col overflow-y-auto px-3 py-4" aria-label="Menu principal">
          {mainItems.slice(0, 1).map((item) => <NavLink key={item.id} item={item} pathname={pathname} collapsed={effectiveCollapsed} />)}
          <FinanceNavGroup items={financeItems} pathname={pathname} collapsed={effectiveCollapsed} />
          <div className="mt-3 flex flex-col gap-0.5 border-t border-nav-line/[0.06] pt-3">
            {mainItems.slice(1).map((item) => <NavLink key={item.id} item={item} pathname={pathname} collapsed={effectiveCollapsed} />)}
          </div>
        </nav>

        <div className="h-px w-full shrink-0 bg-nav-line/[0.075]" />
        <div className="flex items-center gap-3 p-3" data-plan="pro">
          {/* Rodapé da sidebar: exibia `MOCK_USER` — nome e empresa de
              exemplo, fixos no código, para TODA conta. Agora é a sessão
              real. `company` não existe em `/api/auth/me`; no lugar dele, o
              e-mail, que é dado de verdade e identifica a conta. */}
          <Avatar className="h-8 w-8 bg-nav-line/[0.09] ring-1 ring-nav-line/10">
            <AvatarFallback className="bg-transparent text-nav-1">
              {account ? getInitials(account.name) : <ICON_MAP.User className="h-4 w-4 text-nav-3" />}
            </AvatarFallback>
          </Avatar>
          {!effectiveCollapsed && (
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-nav-1">{account?.name ?? '\u00a0'}</span>
              <span className="truncate text-xs text-nav-3">{account?.email ?? '\u00a0'}</span>
            </div>
          )}
          {!isMobile && <button type="button" onClick={toggleSidebar} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} title={collapsed ? 'Expandir menu' : 'Recolher menu'} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-nav-3 hover:bg-nav-line/[0.06] hover:text-nav-1">{collapsed ? <ICON_MAP.ChevronsRight className="h-4 w-4" /> : <ICON_MAP.ChevronsLeft className="h-4 w-4" />}</button>}
        </div>
      </motion.aside>
    </>
  );
}
