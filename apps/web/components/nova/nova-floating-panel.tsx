'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating-panel';
import { NovaWorkspace } from '@/components/nova/nova-workspace';
import { useAppStore } from '@/lib/store';
import type { NovaPersona } from '@/services/nova';

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
  // seja sempre o padrão." Antes este painel confiava só em `activePersona`
  // do store — na prática quase sempre correto (a página /nova ou
  // /legendary já sincroniza `activePersona` ao montar), mas indireto:
  // dependia da ordem de efeitos em vez de olhar pra própria URL. Ler a
  // rota diretamente aqui é a fonte de verdade mais forte possível — "o
  // modal detecta a rota atual", literalmente, sem depender de nenhum outro
  // componente ter rodado antes.
  const pathname = usePathname();
  const routePersona: NovaPersona | undefined = pathname?.startsWith('/legendary')
    ? 'legendary'
    : pathname?.startsWith('/nova')
      ? 'nova'
      : undefined;

  // Fora de /nova e /legendary (ex.: painel aberto do Dashboard, via
  // `AgentWidgetCard`), não há rota "dona" da persona — comportamento
  // antigo permanece: segue `activePersona` do store, com seletor visível
  // dentro do painel (ver `NovaWorkspace`, `!lockedPersona`).
  const activePersona = useAppStore((s) => s.activePersona);
  const effectivePersona = routePersona ?? activePersona;
  const isLegendary = effectivePersona === 'legendary';

  // Mesmo tratamento do `variant="docked"` em `NovaWorkspace` (teste de uso
  // real: resposta nova nascia escondida, exigia rolagem manual) — aqui
  // quem é dono do container de rolagem é este painel, não o `NovaWorkspace`
  // (`variant="inline"`), então a assinatura do balde de mensagens da
  // persona efetiva roda aqui.
  const messages = useAppStore((s) => s.novaMessagesByPersona[effectivePersona]);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [open, messages]);

  return (
    <FloatingPanel
      open={open}
      onOpenChange={setOpen}
      title={isLegendary ? 'LEGENDARY' : 'Nova'}
      description={isLegendary ? 'Converse com a LEGENDARY sem sair da tela.' : 'Converse com a Nova sem sair da tela.'}
      className="max-w-xl"
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <span className="text-sm font-medium text-text-primary">{isLegendary ? 'LEGENDARY' : 'Nova'}</span>
        <DialogPrimitive.Close
          aria-label="Fechar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors duration-fast ease-out hover:bg-white/[0.06] hover:text-text-primary"
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
