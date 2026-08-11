'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating-panel';
import { NovaWorkspace } from '@/components/nova/nova-workspace';
import { useAppStore } from '@/lib/store';
import { useRoutePersona } from '@/lib/use-route-persona';

/**
 * NovaFloatingPanel — painel flutuante da Nova (CONTROL OS — Etapa 3).
 *
 * "Nunca trocar de página. Nunca abrir /nova. Tudo acontece na mesma
 * tela." — aberto pelo `NovaFloatingLauncher` por cima do módulo atual
 * (Dashboard, Missões, Financeiro...). Reaproveita o mesmo `NovaWorkspace`
 * usado na Home — mesma lógica de conversa e execução de ações, sem
 * duplicar nada — só sem o Painel Inteligente (a página de origem já
 * mostra os dados dela).
 */
export function NovaFloatingPanel() {
  const open = useAppStore((s) => s.novaPanelOpen);
  const setOpen = useAppStore((s) => s.setNovaPanelOpen);

  // CONTROL OS — "o modal deve detectar automaticamente a rota atual (/nova
  // ou /legendary) e iniciar já na IA correspondente. Não quero que a NOVA
  // seja sempre o padrão." `useRoutePersona` lê a rota diretamente
  // (`usePathname`), a fonte de verdade mais forte possível — nunca
  // depende de `activePersona` já ter sido sincronizado por outro
  // componente. Fora de /nova e /legendary (ex.: painel aberto do
  // Dashboard, via `AgentWidgetCard`), `routePersona` é `undefined` e
  // `effectivePersona` cai pra `activePersona` do store — comportamento
  // antigo, com seletor visível dentro do painel (ver `NovaWorkspace`,
  // `!lockedPersona`).
  const { routePersona, effectivePersona } = useRoutePersona();
  const isLegendary = effectivePersona === 'legendary';

  // Mesmo tratamento do `variant="docked"` em `NovaWorkspace` (teste de uso
  // real: resposta nova nascia escondida, exigia rolagem manual) — aqui
  // quem é dono do container de rolagem é este painel, não o `NovaWorkspace`
  // (`variant="inline"`), então a assinatura do balde de mensagens da
  // persona efetiva roda aqui.
  const messages = useAppStore((s) => s.novaMessagesByPersona[effectivePersona]);
  const lastMessageMutation = useAppStore((s) => s.novaConversationByPersona[effectivePersona].lastMessageMutation);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    if (lastMessageMutation !== 'prepend') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [open, messages, lastMessageMutation]);

  return (
    <FloatingPanel
      open={open}
      onOpenChange={setOpen}
      title={isLegendary ? 'LEGENDARY' : 'Nova'}
      description={isLegendary ? 'Converse com a LEGENDARY sem sair da tela.' : 'Converse com a Nova sem sair da tela.'}
      className="max-w-xl"
    >
      <div className="flex items-center justify-between border-b border-tint/[0.08] px-4 py-3">
        <span className="text-sm font-medium text-text-primary">{isLegendary ? 'LEGENDARY' : 'Nova'}</span>
        <DialogPrimitive.Close
          aria-label="Fechar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors duration-fast ease-out hover:bg-tint/[0.06] hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </div>
      <div ref={scrollRef} className="max-h-[70vh] overflow-y-auto p-4">
        <NovaWorkspace showIntelligentPanel={false} lockedPersona={routePersona} />
      </div>
    </FloatingPanel>
  );
}
