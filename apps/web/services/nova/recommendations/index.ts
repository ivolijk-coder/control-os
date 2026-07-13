import type { NovaReadOnlyContext } from '../interfaces';

/**
 * Recommendation Engine (CONTROL OS — Etapa 7: IA-Native). Produz
 * recomendações — nunca envia notificação nenhuma ainda ("Ela não envia
 * notificações ainda. Ela apenas produz recomendações."). Cada heurística
 * abaixo só dispara com base em dado real de `NovaReadOnlyContext` — os
 * limiares (`AGENDA_OVERLOAD_THRESHOLD` etc.) são constantes de regra de
 * negócio definidas aqui, nunca um valor inventado sobre o usuário (ex.:
 * nunca compara com um "orçamento" que não existe no modelo de dados — ver
 * `services/ai/prompts/SystemPrompt.ts`, "Análises").
 */
export type NovaRecommendationCategory =
  | 'reduzir_gastos'
  | 'concluir_habitos'
  | 'reorganizar_agenda'
  | 'antecipar_metas'
  | 'revisar_gastos'
  | 'priorizar_tarefas';

export interface NovaRecommendation {
  category: NovaRecommendationCategory;
  message: string;
}

const AGENDA_OVERLOAD_THRESHOLD = 4;
const GOAL_NEAR_COMPLETION_PROGRESS = 80;
/** Fração dos gastos do mês concentrada numa única categoria a partir da qual vale destacar. */
const CATEGORY_CONCENTRATION_RATIO = 0.5;
/** Nº mínimo de lançamentos do mês pra uma leitura de "categoria concentrada" fazer sentido (não alarmar com 1 lançamento isolado). */
const MIN_ENTRIES_FOR_CATEGORY_INSIGHT = 3;

function monthPrefixOf(date: string): string {
  return date.slice(0, 7);
}

export function generateRecommendations(ctx: NovaReadOnlyContext): NovaRecommendation[] {
  const recommendations: NovaRecommendation[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = monthPrefixOf(today);

  const despesasMes = ctx.financeEntries.filter((entry) => entry.type === 'despesa' && entry.date.startsWith(monthPrefix));
  const receitasMes = ctx.financeEntries.filter((entry) => entry.type === 'receita' && entry.date.startsWith(monthPrefix));
  const totalDespesas = despesasMes.reduce((sum, entry) => sum + entry.amount, 0);
  const totalReceitas = receitasMes.reduce((sum, entry) => sum + entry.amount, 0);

  if (despesasMes.length > 0 && totalDespesas > totalReceitas) {
    recommendations.push({
      category: 'reduzir_gastos',
      message: `As despesas do mês (R$ ${totalDespesas.toFixed(2)}) já superam as receitas registradas (R$ ${totalReceitas.toFixed(2)}) — pode valer revisar os próximos gastos.`,
    });
  }

  if (despesasMes.length >= MIN_ENTRIES_FOR_CATEGORY_INSIGHT && totalDespesas > 0) {
    const totalsByCategory = new Map<string, number>();
    for (const entry of despesasMes) {
      totalsByCategory.set(entry.category, (totalsByCategory.get(entry.category) ?? 0) + entry.amount);
    }
    const topEntry = [...totalsByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topEntry && topEntry[1] / totalDespesas >= CATEGORY_CONCENTRATION_RATIO) {
      const [topCategory, topTotal] = topEntry;
      recommendations.push({
        category: 'revisar_gastos',
        message: `"${topCategory}" concentra a maior parte dos gastos do mês (R$ ${topTotal.toFixed(2)} de R$ ${totalDespesas.toFixed(2)}) — pode ser um bom ponto de revisão.`,
      });
    }
  }

  const habitosPendentes = ctx.habits.filter((habit) => !habit.completedToday);
  if (habitosPendentes.length > 0) {
    recommendations.push({
      category: 'concluir_habitos',
      message: `Ainda restam ${habitosPendentes.length} hábito${habitosPendentes.length > 1 ? 's' : ''} pendente${habitosPendentes.length > 1 ? 's' : ''} hoje.`,
    });
  }

  const eventosHoje = ctx.agendaEvents.filter((event) => event.date === today);
  if (eventosHoje.length > AGENDA_OVERLOAD_THRESHOLD) {
    recommendations.push({
      category: 'reorganizar_agenda',
      message: `Hoje tem ${eventosHoje.length} compromissos na agenda — pode valer reorganizar.`,
    });
  }

  const metaProxima = ctx.missions
    .filter((mission) => mission.kind === 'meta' && mission.status !== 'concluida' && mission.progress >= GOAL_NEAR_COMPLETION_PROGRESS)
    .sort((a, b) => b.progress - a.progress)[0];
  if (metaProxima) {
    recommendations.push({
      category: 'antecipar_metas',
      message: `A meta "${metaProxima.title}" já está em ${metaProxima.progress}% — pode valer antecipar os próximos passos.`,
    });
  }

  const missõesEmRisco = ctx.missions.filter((mission) => mission.status === 'em_risco');
  if (missõesEmRisco.length > 0) {
    recommendations.push({
      category: 'priorizar_tarefas',
      message: `${missõesEmRisco.length} missão${missõesEmRisco.length > 1 ? 'ões' : ''} em risco de prazo — pode valer priorizar essa${missõesEmRisco.length > 1 ? 's' : ''} primeiro.`,
    });
  }

  return recommendations;
}

/**
 * Leitura rápida e real do momento financeiro — usada como `lastAnalysis`
 * do NOVA STATE (ver `services/nova/state`). Não é um relatório completo,
 * só uma frase com números reais, no mesmo espírito de
 * `buildModelContextSummary` (services/ai) — duplicada aqui de propósito
 * (não importada de lá) porque `services/nova` nunca deve depender de
 * `services/ai` (a direção de dependência é sempre ai → nova, nunca o
 * contrário — ver `services/ai/index.ts`).
 */
export function buildQuickAnalysis(ctx: NovaReadOnlyContext): string {
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = monthPrefixOf(today);
  const despesasMes = ctx.financeEntries.filter((entry) => entry.type === 'despesa' && entry.date.startsWith(monthPrefix));
  const receitasMes = ctx.financeEntries.filter((entry) => entry.type === 'receita' && entry.date.startsWith(monthPrefix));
  const totalDespesas = despesasMes.reduce((sum, entry) => sum + entry.amount, 0);
  const totalReceitas = receitasMes.reduce((sum, entry) => sum + entry.amount, 0);
  const saldo = totalReceitas - totalDespesas;
  return `Saldo do mês: R$ ${saldo.toFixed(2)} (receitas R$ ${totalReceitas.toFixed(2)} − despesas R$ ${totalDespesas.toFixed(2)}).`;
}
