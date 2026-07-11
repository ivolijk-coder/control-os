'use client';

import * as React from 'react';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

/**
 * Layout Principal — casca estrutural de toda área autenticada do CONTROL OS
 * (Sidebar + Topbar + conteúdo). Compartilhado por Dashboard e, nas fases
 * seguintes, por todas as demais telas.
 */
export function LayoutPrincipal({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
