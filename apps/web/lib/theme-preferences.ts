export type AppTheme = 'dark' | 'light';

const STORAGE_KEY = 'control-os-theme';

/**
 * O CLARO É O PADRÃO A PARTIR DAQUI.
 *
 * A regra virou de lado, e a inversão é deliberada: antes qualquer coisa
 * que não fosse exatamente `'light'` caía no escuro; agora qualquer coisa
 * que não seja exatamente `'dark'` cai no claro. Quem já escolheu o escuro
 * tem `'dark'` gravado e continua no escuro — a preferência salva sempre
 * ganha. Quem nunca abriu a tela de aparência passa a abrir no claro.
 *
 * Isto só pôde acontecer depois que as 41 telas migraram para token, a
 * ponte de `!important` morreu e os três defeitos visíveis do claro foram
 * corrigidos. Promover o claro antes disso teria feito das "cores bugadas"
 * a primeira coisa que todo usuário via.
 *
 * A mesma regra está duplicada, de propósito, no script síncrono do
 * `app/layout.tsx` — ele roda antes de qualquer JavaScript de aplicação
 * para evitar o piscar de tema. As duas precisam concordar, e há um gate
 * conferindo que concordam.
 */
export function getThemePreference(): AppTheme {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

/** Aplica e persiste a aparência sem exigir recarregar a página. */
export function setThemePreference(theme: AppTheme): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, theme);
  document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new CustomEvent<AppTheme>('control-os-theme-change', { detail: theme }));
}
