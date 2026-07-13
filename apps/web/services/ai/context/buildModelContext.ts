import type { AIConversationContext } from '../types';

/**
 * Monta o resumo compacto de contexto enviado a um provedor de IA real
 * (CONTROL OS — Etapa 4). "Nunca enviar dados desnecessários" — em vez de
 * serializar os arrays inteiros (`financeEntries`, `missions` etc., que
 * podem chegar a centenas de itens numa conta madura), condensa cada
 * domínio em totais/contagens/destaques, como um humano resumiria o
 * próprio dia pra outra pessoa. `MockAIProvider` nunca usa isto — só
 * `OpenAIProvider`, ao montar o payload pra `app/api/ai/nova/route.ts`.
 */
export function buildModelContextSummary(ctx: AIConversationContext): string {
  const today = new Date().toISOString().slice(0, 10);

  const eventosHoje = ctx.agendaEvents.filter((event) => event.date === today);
  const despesasHoje = ctx.financeEntries.filter((entry) => entry.type === 'despesa' && entry.date.slice(0, 10) === today);
  const receitasHoje = ctx.financeEntries.filter((entry) => entry.type === 'receita' && entry.date.slice(0, 10) === today);
  const metasAtivas = ctx.missions.filter((mission) => mission.kind === 'meta' && mission.status !== 'concluida');
  const missõesEmRisco = ctx.missions.filter((mission) => mission.status === 'em_risco');
  const habitosPendentes = ctx.habits.filter((habit) => !habit.completedToday);
  const dividasAbertas = ctx.debts.filter((debt) => debt.remainingAmount > 0);
  const proximaViagem = [...ctx.trips].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  const lines: string[] = [
    `Usuário: ${ctx.userName}`,
    `Compromissos hoje: ${eventosHoje.length}`,
    `Despesas hoje: ${despesasHoje.length} lançamento(s)`,
    `Receitas hoje: ${receitasHoje.length} lançamento(s)`,
    `Metas em andamento: ${metasAtivas.length}${metasAtivas.length > 0 ? ` (ex.: "${metasAtivas[0]?.title}" em ${metasAtivas[0]?.progress}%)` : ''}`,
    `Missões em risco de prazo: ${missõesEmRisco.length}`,
    `Hábitos pendentes hoje: ${habitosPendentes.length} de ${ctx.habits.length}`,
    `Dívidas em aberto: ${dividasAbertas.length}`,
    `Documentos cadastrados: ${ctx.documents.length}`,
    `Bens patrimoniais cadastrados: ${ctx.assets.length}`,
    `Notas cadastradas: ${ctx.notes.length}`,
  ];

  if (proximaViagem) {
    lines.push(`Próxima viagem: ${proximaViagem.destination} (${proximaViagem.startDate})`);
  }
  if (ctx.preferences.length > 0) {
    lines.push(`Preferências conhecidas: ${ctx.preferences.join('; ')}`);
  }

  return lines.join('\n');
}
