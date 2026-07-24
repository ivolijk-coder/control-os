'use client';

import * as React from 'react';
import { Avatar, AvatarFallback } from '@control-os/ui';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { ICON_MAP } from '@/components/layout/icon-map';
import { getInitials } from '@/lib/utils';

/**
 * Configurações — página nova, criada junto com a simplificação da Sidebar
 * (fim dos Control Spaces™, navegação flat de "pessoa física").
 *
 * `nav_configuracoes` entrou na lista final de navegação pedida pelo
 * usuário; como `mock-data.ts` historicamente evita apontar um item de menu
 * para uma rota sem página ("nunca existir um link morto no meio do
 * caminho"), esta tela mínima nasce junto com o item — só identidade e
 * preferências básicas, mesmo padrão visual de qualquer outra página do
 * produto (`GlassCard`/`FadeIn`, nenhum componente novo). Conteúdo completo
 * (plano, integrações, notificações etc.) é trabalho futuro, fora do escopo
 * desta mudança de navegação.
 */
export default function ConfiguracoesPage() {
  const [whatsApp, setWhatsApp] = React.useState<{ status: 'loading' | 'active' | 'pending' | 'unauthenticated'; phone?: string }>({ status: 'loading' });
  const [account, setAccount] = React.useState<{ name: string; email: string } | null>(null);

  React.useEffect(() => {
    fetch('/api/account/whatsapp')
      .then(async (response) => ({ response, data: await response.json() as { status?: 'active' | 'pending'; phone?: string } }))
      .then(({ response, data }) => setWhatsApp(response.ok ? { status: data.status ?? 'pending', phone: data.phone } : { status: 'unauthenticated' }))
      .catch(() => setWhatsApp({ status: 'unauthenticated' }));
  }, []);

  React.useEffect(() => {
    fetch('/api/auth/me')
      .then(async (response) => ({ response, data: await response.json() as { user?: { name: string; email: string } } }))
      .then(({ response, data }) => setAccount(response.ok ? data.user ?? null : null))
      .catch(() => setAccount(null));
  }, []);

  const whatsAppContent =
    whatsApp.status === 'loading' ? 'Verificando conexão…' :
    whatsApp.status === 'active' ? `Ativo · ${whatsApp.phone}` :
    whatsApp.status === 'pending' ? 'Aguardando confirmação do número' :
    'Entre novamente para ver sua configuração';

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <h1 className="text-lg font-semibold text-text-primary">Configurações</h1>
      </FadeIn>

      <FadeIn delay={0.05}>
        <GlassCard interactive={false} className="flex items-center gap-4 p-5">
          <Avatar className="h-12 w-12 ring-1 ring-white/10">
            <AvatarFallback>{getInitials(account?.name ?? 'Sua conta')}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-text-primary">{account?.name ?? 'Sua conta'}</span>
            <span className="truncate text-xs text-text-tertiary">{account?.email ?? 'Entre para ver seus dados'}</span>
          </div>
        </GlassCard>
      </FadeIn>

      <FadeIn delay={0.1}>
        <GlassCard interactive={false} className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-3">
            <ICON_MAP.Settings className="h-4 w-4 shrink-0 text-text-tertiary" />
            <span className="text-sm font-medium text-text-primary">WhatsApp</span>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-md bg-white/[0.04] px-4 py-3">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-text-tertiary">Status da conexão</span>
              <span className="text-sm text-text-primary">{whatsAppContent}</span>
            </div>
            {whatsApp.status === 'active' ? (
              <span className="rounded-full bg-accent-green/15 px-2.5 py-1 text-xs font-medium text-accent-green">Vinculado</span>
            ) : (
              <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-xs text-text-secondary">Pendente</span>
            )}
          </div>
          <p className="text-xs text-text-tertiary">Mensagens recebidas por um número vinculado são registradas somente na conta correspondente.</p>
        </GlassCard>
      </FadeIn>
    </div>
  );
}
