'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { FloatingPanel } from '@/components/ui/floating-panel';
import { NovaWorkspace } from '@/components/nova/nova-workspace';
import { useAppStore } from '@/lib/store';

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

  return (
    <FloatingPanel
      open={open}
      onOpenChange={setOpen}
      title="Nova"
      description="Converse com a Nova sem sair da tela."
      className="max-w-xl"
    >
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
        <span className="text-sm font-medium text-text-primary">Nova</span>
        <DialogPrimitive.Close
          aria-label="Fechar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary transition-colors duration-fast ease-out hover:bg-white/[0.06] hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-4">
        <NovaWorkspace showIntelligentPanel={false} />
      </div>
    </FloatingPanel>
  );
}
