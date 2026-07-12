import type { AgendaEvent, FinanceEntry, Mission } from '@control-os/types';

/**
 * Resumo do dia (CONTROL OS — Etapa 3): destaques reais derivados de
 * `useDataStore` — missões em risco, compromissos de hoje, lançamentos
 * financeiros recentes e se os gastos já superaram a receita registrada.
 * Nunca inventa sinais de domínios que ainda não existem (ex.: hábitos,
 * orçamento planejado) — só o que dá pra calcular com os dados reais de
 * hoje. Base de `buildDailyCheckIn` (mensagem em texto, para canais sem UI
 * como o futuro adapter de WhatsApp). A Home (`/nova`) não usa mais este
 * resumo em texto — ficou propositalmente limpa, só a `NovaOrb` e a
 * conversa (pedido explícito do usuário).
 */
export function buildTodayHighlights(
  missions: Mission[],
  agendaEvents: AgendaEvent[],
  financeEntries: FinanceEntry[]
): string[] {
  const today = new Date().toISOString().slice(0, 10);

  const missionsEmRisco = missions.filter((mission) => mission.status === 'em_risco').length;
  const compromissosHoje = agendaEvents.filter((event) => event.date === today).length;
  const lancamentosRecentes = financeEntries.length;

  const receitaTotal = financeEntries
    .filter((entry) => entry.type === 'receita')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const gastosTotal = financeEntries
    .filter((entry) => entry.type === 'despesa')
    .reduce((sum, entry) => sum + entry.amount, 0);

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
  if (gastosTotal > receitaTotal && gastosTotal > 0) {
    highlights.push('Gastos já superam a receita registrada');
  }

  return highlights;
}

/**
 * Versão em texto do resumo do dia — usada como mensagem proativa em
 * canais sem interface visual (ex.: adapter de WhatsApp).
 */
export function buildDailyCheckIn(
  missions: Mission[],
  agendaEvents: AgendaEvent[],
  financeEntries: FinanceEntry[]
): string {
  const highlights = buildTodayHighlights(missions, agendaEvents, financeEntries);

  if (highlights.length === 0) {
    return 'Bom dia. Não encontrei pendências críticas — seu dia está tranquilo. Quer organizar alguma coisa mesmo assim?';
  }

  const bullets = highlights.map((item) => `• ${item}`).join('\n');
  return `Bom dia. Hoje encontrei:\n${bullets}\nPosso organizar seu dia?`;
}
