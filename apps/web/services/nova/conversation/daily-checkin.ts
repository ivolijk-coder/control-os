import type { AgendaEvent, FinanceEntry, Habit, Mission } from '@control-os/types';

/**
 * Resumo do dia (CONTROL OS — Sistema Operacional Pessoal): destaques reais
 * derivados de `useDataStore` — compromissos de hoje, missões em risco,
 * hábitos pendentes, lançamentos financeiros recentes e se os gastos já
 * superaram a receita registrada. Nunca inventa sinais de domínios que
 * ainda não existem — só o que dá pra calcular com os dados reais de hoje.
 * Base de `buildDailyCheckIn` — usada tanto pelo intent `consultar_dia` da
 * Nova ("O que preciso fazer hoje?", "Organize meu dia") quanto,
 * futuramente, por canais sem UI (ex.: adapter de WhatsApp). A Home
 * (`/nova`) não usa mais este resumo como painel fixo — ficou
 * propositalmente limpa, só a `NovaOrb` e a conversa (pedido explícito do
 * usuário) — mas o texto aparece como resposta quando ele pede.
 */
export function buildTodayHighlights(
  missions: Mission[],
  agendaEvents: AgendaEvent[],
  financeEntries: FinanceEntry[],
  habits: Habit[] = []
): string[] {
  const today = new Date().toISOString().slice(0, 10);

  const missionsEmRisco = missions.filter((mission) => mission.status === 'em_risco').length;
  const compromissosHoje = agendaEvents.filter((event) => event.date === today).length;
  const lancamentosRecentes = financeEntries.length;
  const habitosPendentes = habits.filter((habit) => !habit.completedToday).length;

  const receitaTotal = financeEntries
    .filter((entry) => entry.type === 'receita')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const gastosTotal = financeEntries
    .filter((entry) => entry.type === 'despesa')
    .reduce((sum, entry) => sum + entry.amount, 0);

  const highlights: string[] = [];
  if (compromissosHoje > 0) {
    highlights.push(`${compromissosHoje} compromisso${compromissosHoje > 1 ? 's' : ''} hoje`);
  }
  if (missionsEmRisco > 0) {
    highlights.push(`${missionsEmRisco} missão${missionsEmRisco > 1 ? 'ões' : ''} em risco de prazo`);
  }
  if (habitosPendentes > 0) {
    highlights.push(`${habitosPendentes} hábito${habitosPendentes > 1 ? 's' : ''} ainda pendente${habitosPendentes > 1 ? 's' : ''} hoje`);
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
 * Versão em texto do resumo do dia — resposta ao intent `consultar_dia` da
 * Nova, e mensagem proativa em canais sem interface visual (ex.: adapter
 * de WhatsApp).
 */
export function buildDailyCheckIn(
  missions: Mission[],
  agendaEvents: AgendaEvent[],
  financeEntries: FinanceEntry[],
  habits: Habit[] = []
): string {
  const highlights = buildTodayHighlights(missions, agendaEvents, financeEntries, habits);

  if (highlights.length === 0) {
    return 'Não encontrei pendências críticas — seu dia está tranquilo. Quer organizar alguma coisa mesmo assim?';
  }

  const bullets = highlights.map((item) => `• ${item}`).join('\n');
  return `Olhando seu dia, encontrei:\n${bullets}\nPosso organizar alguma dessas coisas?`;
}
