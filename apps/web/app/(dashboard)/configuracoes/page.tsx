'use client';

import { Avatar, AvatarFallback } from '@control-os/ui';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { ICON_MAP } from '@/components/layout/icon-map';
import { MOCK_USER } from '@/lib/mock-data';
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
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <h1 className="text-lg font-semibold text-text-primary">Configurações</h1>
      </FadeIn>

      <FadeIn delay={0.05}>
        <GlassCard interactive={false} className="flex items-center gap-4 p-5">
          <Avatar className="h-12 w-12 ring-1 ring-white/10">
            <AvatarFallback>{getInitials(MOCK_USER.name)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-text-primary">{MOCK_USER.name}</span>
            <span className="truncate text-xs text-text-tertiary">{MOCK_USER.email}</span>
          </div>
        </GlassCard>
      </FadeIn>

      <FadeIn delay={0.1}>
        <GlassCard interactive={false} className="flex items-center gap-3 p-8 text-center text-sm text-text-secondary">
          <ICON_MAP.Settings className="h-4 w-4 shrink-0 text-text-tertiary" />
          <span>Preferências, plano e integrações chegam em breve por aqui.</span>
        </GlassCard>
      </FadeIn>
    </div>
  );
}
