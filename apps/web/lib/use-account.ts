'use client';

import * as React from 'react';

export interface Account {
  name: string;
  email: string;
}

/**
 * `useAccount` — o usuário autenticado desta sessão, do lado do cliente.
 *
 * Existia um buraco: a única tela que sabia quem estava logado era
 * `/configuracoes`, que buscava `GET /api/auth/me` no seu próprio
 * `useEffect`. Todo o resto do produto exibia dado de exemplo — a `Topbar`
 * lia `MOCK_USER` de `lib/mock-data`, e `useNovaContext` devolvia a string
 * literal `'Usuário'`. Era por isso que a saudação da NOVA cumprimentava
 * "Usuário" e o avatar mostrava iniciais que não eram as suas.
 *
 * A rota já existia e já devolvia exatamente `{ name, email }` da sessão
 * assinada (`currentSessionUserId`); faltava um caminho compartilhado até
 * ela. Este hook é esse caminho — nenhuma rota nova, nenhum campo novo,
 * nenhuma mudança de contrato.
 *
 * A resposta é memorizada em módulo: vários componentes montados na mesma
 * página (Topbar, a saudação da NOVA, a da LEGENDARY) disparam UMA
 * requisição só, não três. Falha e 401 resolvem para `null`, e quem
 * consome decide o que mostrar enquanto isso — nunca um nome inventado.
 */
let cachedAccount: Account | null = null;
let inflight: Promise<Account | null> | null = null;

function loadAccount(): Promise<Account | null> {
  if (cachedAccount) return Promise.resolve(cachedAccount);
  inflight ??= fetch('/api/auth/me')
    .then(async (response) => {
      if (!response.ok) return null;
      const data = (await response.json()) as { user?: Account };
      return data.user ?? null;
    })
    .catch(() => null)
    .then((account) => {
      cachedAccount = account;
      inflight = null;
      return account;
    });
  return inflight;
}

export function useAccount(): Account | null {
  const [account, setAccount] = React.useState<Account | null>(cachedAccount);

  React.useEffect(() => {
    let active = true;
    void loadAccount().then((loaded) => {
      if (active) setAccount(loaded);
    });
    return () => {
      active = false;
    };
  }, []);

  return account;
}
