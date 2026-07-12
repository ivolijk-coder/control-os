import type { AgendaEvent, FinanceEntry, Mission } from '@control-os/types';

/**
 * Check-in diário (CONTROL OS 3.0): sempre que o usuário abre o sistema, a
 * Nova cumprimenta com um resumo real (missões em risco, compromissos de
 * hoje, lançamentos financeiros recentes) — em vez de esperar o usuário
 * perguntar. Lê diretamente de `useDataStore`, a mesma fonte que a
 * navegação manual usa.
 */
export function buildDailyCheckIn(
  missions: Mission[],
  agendaEvents: AgendaEvent[],
  financeEntries: FinanceEntry[]
): string {
  const today = new Date().toISOString().slice(0, 10);

  const missionsEmRisco = missions.filter((mission) => mission.status === 'em_risco').length;
  const compromissosHoje = agendaEvents.filter((event) => event.date === today).length;
  const lancamentosRecentes = financeEntries.length;

  const highlights: string[] = [];
  if (missionsEmRisco > 0) {
    highlights.push(`${missionsEmRisco} missão${missionsEmRisco > 1 ? 'ões' : ''} em risco de prazo`);
  }
  if (compromissosHoje > 0) {
    highlights.push(`${compromissosHoje} compromisso${compromissosHoje > 1 ? 's' : ''} hoje`);
  }
  if (lancamentosRecentes > 0) {
    highlights.push(`${lancamentosRecentes} lançamento${lancamentosRecentes > 1 ? 's' : ''} no Financeiro`);
  }

  if (highlights.length === 0) {
    return 'Bom dia. Não encontrei pendências críticas — seu dia está tranquilo. Quer organizar alguma coisa mesmo assim?';
  }

  const bullets = highlights.map((item) => `• ${item}`).join('\n');
  return `Bom dia. Hoje encontrei:\n${bullets}\nPosso organizar seu dia?`;
}
