import type { AgendaEvent, FinanceEntry, Habit, Mission } from '@control-os/types';
import { toLocalDateString } from '../date';

/**
 * Resumo do dia (CONTROL OS — Sistema Operacional Pessoal): destaques reais
 * derivados de `useDataStore` — compromissos de hoje (com horário, um por
 * linha), missões em risco, hábitos pendentes, lançamentos financeiros
 * recentes e se os gastos já superaram a receita registrada. Nunca inventa
 * sinais de domínios que ainda não existem — só o que dá pra calcular com
 * os dados reais de hoje. Base de `buildDailyCheckIn` — usada tanto pelo
 * intent `consultar_dia` da Nova ("Oi", "O que preciso fazer hoje?",
 * "Organize meu dia") quanto, futuramente, por canais sem UI (ex.: adapter
 * de WhatsApp). A Home (`/nova`) não usa mais este resumo como painel fixo
 * — ficou propositalmente limpa, só a `NovaOrb` e a conversa (pedido
 * explícito do usuário) — mas o texto aparece como resposta quando ele pede
 * ou simplesmente cumprimenta a Nova.
 */
export function buildTodayHighlights(
  missions: Mission[],
  agendaEvents: AgendaEvent[],
  financeEntries: FinanceEntry[],
  habits: Habit[] = []
): string[] {
  // Bugfix: `toISOString().slice(0, 10)` extraía a data em UTC — ver `services/nova/date.ts`.
  const today = toLocalDateString();

  const missionsEmRisco = missions.filter((mission) => mission.status === 'em_risco').length;
  const eventosHoje = agendaEvents
    .filter((event) => event.date === today)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const lancamentosRecentes = financeEntries.length;
  const habitosPendentes = habits.filter((habit) => !habit.completedToday).length;

  const receitaTotal = financeEntries
    .filter((entry) => entry.type === 'receita')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const gastosTotal = financeEntries
    .filter((entry) => entry.type === 'despesa')
    .reduce((sum, entry) => sum + entry.amount, 0);

  const highlights: string[] = [];
  // Um item por compromisso (com horário) — mais útil do que só a contagem
  // quando a pergunta é literalmente "o que eu tenho hoje".
  eventosHoje.forEach((event) => {
    highlights.push(event.time ? `${event.time} — ${event.title}` : event.title);
  });
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
 * Nova (disparado tanto por uma saudação simples — "oi", "bom dia" —
 * quanto por um pedido explícito — "organize meu dia"), e mensagem
 * proativa em canais sem interface visual (ex.: adapter de WhatsApp).
 * `firstName`, quando informado, personaliza a abertura — "Olá, Ivoli!" —
 * do jeito que o usuário pediu explicitamente.
 */
export function buildDailyCheckIn(
  missions: Mission[],
  agendaEvents: AgendaEvent[],
  financeEntries: FinanceEntry[],
  habits: Habit[] = [],
  firstName?: string
): string {
  const highlights = buildTodayHighlights(missions, agendaEvents, financeEntries, habits);
  const greeting = firstName ? `Olá, chefe. Como está seu dia, ${firstName}?` : 'Olá, chefe. Como está seu dia?';

  if (highlights.length === 0) {
    return `${greeting} Está tudo tranquilo por enquanto. Quer organizar alguma coisa?`;
  }

  const summary = highlights.slice(0, 3).join(', ');
  return `${greeting} Hoje eu vi: ${summary}. Quer que eu priorize algo?`;
}
