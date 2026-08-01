import { toLocalDateString } from '../date';
import { buildDocumentInsightMessage } from '../conversation/document-insight-message';
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
  | 'priorizar_tarefas'
  // CONTROL OS — Etapa 13 (NOVA Proativa): categorias novas, mesmo princípio
  // das seis acima (dado real, nunca inventado; ver função por função abaixo
  // pra origem exata de cada uma).
  | 'gasto_semanal_alto'
  | 'retomar_registro'
  | 'reconhecer_consistencia'
  | 'revisar_fluxo_caixa'
  | 'acompanhar_meta'
  | 'acompanhar_projeto'
  | 'viagem_proxima'
  // Ponte Documentos -> NOVA: um documento analisado ainda aguarda decisão
  // do usuário (financeiro ou não) — ver `DocumentInsight`/`buildDocumentInsightMessage`.
  | 'documento_analisado';

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

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Quanto a semana atual precisa superar a anterior pra virar insight — evita alarmar com uma diferença de poucos reais. */
const WEEKLY_SPEND_INCREASE_RATIO = 1.2;
/** Dias sem nenhuma despesa registrada antes de perguntar se o usuário esqueceu de anotar. */
const DAYS_WITHOUT_EXPENSE_THRESHOLD = 3;
/** Missões concluídas seguidas (sem nenhuma outra ação da Timeline entre elas) pra reconhecer consistência. */
const CONSECUTIVE_MISSIONS_THRESHOLD = 3;
/** Dias desde a criação de uma meta/projeto, ainda sem conclusão, pra a Nova perguntar como está o andamento. */
const STALE_GOAL_DAYS_THRESHOLD = 3;
/** Dias de antecedência pra avisar que uma viagem já cadastrada está próxima. */
const UPCOMING_TRIP_DAYS_THRESHOLD = 7;

function monthPrefixOf(date: string): string {
  return date.slice(0, 7);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.floor((new Date(toIso).getTime() - new Date(fromIso).getTime()) / MS_PER_DAY);
}

export function generateRecommendations(ctx: NovaReadOnlyContext): NovaRecommendation[] {
  const recommendations: NovaRecommendation[] = [];
  // Bugfix: `toISOString().slice(0, 10)` extraía a data em UTC — ver `services/nova/date.ts`.
  const today = toLocalDateString();
  const monthPrefix = monthPrefixOf(today);

  // Ponte Documentos -> NOVA (evento interno "documento analisado"): um
  // achado novo e concreto sobre um documento específico vem primeiro —
  // nunca inventado, é a mesma classificação que já decidiu não criar a
  // proposta financeira sozinha (`decideDocumentAction`, ver
  // `services/documents/contract-analysis.ts`). Uma recomendação por
  // documento pendente; `buildProactiveOpening` só fala a de maior
  // prioridade por vez, nunca todas de uma vez.
  for (const insight of ctx.documentInsights) {
    recommendations.push({ category: 'documento_analisado', message: buildDocumentInsightMessage(insight) });
  }

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
      // Etapa 13: reaproximado do exemplo do spec ("Você está muito
      // próximo de concluir sua meta.") — continua citando título e
      // progresso reais, só a abertura da frase ficou mais direta.
      message: `Você está muito próximo de concluir sua meta "${metaProxima.title}" (${metaProxima.progress}%) — pode valer antecipar os próximos passos.`,
    });
  }

  const missõesEmRisco = ctx.missions.filter((mission) => mission.status === 'em_risco');
  if (missõesEmRisco.length > 0) {
    recommendations.push({
      category: 'priorizar_tarefas',
      message: `${missõesEmRisco.length} missão${missõesEmRisco.length > 1 ? 'ões' : ''} em risco de prazo — pode valer priorizar essa${missõesEmRisco.length > 1 ? 's' : ''} primeiro.`,
    });
  }

  // CONTROL OS — Etapa 13 (NOVA Proativa) — a partir daqui, categorias
  // novas. Mesmo princípio das anteriores: só dispara com dado real, nunca
  // um valor inventado.

  // Semana atual vs semana anterior (mesmo padrão de "hoje vs ontem" já
  // usado em `services/nova/insights`) — só compara quando as duas semanas
  // têm despesa real lançada, nunca contra uma base vazia.
  const seteDiasAtras = toLocalDateString(new Date(Date.now() - 7 * MS_PER_DAY));
  const catorzeDiasAtras = toLocalDateString(new Date(Date.now() - 14 * MS_PER_DAY));
  const despesasSemanaAtual = ctx.financeEntries.filter(
    (entry) => entry.type === 'despesa' && entry.date >= seteDiasAtras && entry.date <= today
  );
  const despesasSemanaAnterior = ctx.financeEntries.filter(
    (entry) => entry.type === 'despesa' && entry.date >= catorzeDiasAtras && entry.date < seteDiasAtras
  );
  if (despesasSemanaAtual.length > 0 && despesasSemanaAnterior.length > 0) {
    const totalSemanaAtual = despesasSemanaAtual.reduce((sum, entry) => sum + entry.amount, 0);
    const totalSemanaAnterior = despesasSemanaAnterior.reduce((sum, entry) => sum + entry.amount, 0);
    if (totalSemanaAtual >= totalSemanaAnterior * WEEKLY_SPEND_INCREASE_RATIO) {
      recommendations.push({
        category: 'gasto_semanal_alto',
        message: `Percebi que esta semana você gastou mais do que na semana passada (R$ ${totalSemanaAtual.toFixed(2)} contra R$ ${totalSemanaAnterior.toFixed(2)}).`,
      });
    }
  }

  // Nenhuma despesa registrada nos últimos dias — só dispara se já existe
  // pelo menos um lançamento no histórico (nunca alarma um usuário
  // completamente novo, que nunca registrou nada).
  if (ctx.financeEntries.some((entry) => entry.type === 'despesa')) {
    const ultimaDespesa = [...ctx.financeEntries]
      .filter((entry) => entry.type === 'despesa')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    const diasSemRegistro = ultimaDespesa ? daysBetween(ultimaDespesa.date, today) : 0;
    if (diasSemRegistro >= DAYS_WITHOUT_EXPENSE_THRESHOLD) {
      recommendations.push({
        category: 'retomar_registro',
        message: `Faz ${diasSemRegistro} dias que você não registra nenhuma despesa — se gastou algo nesse meio tempo, é só me contar.`,
      });
    }
  }

  // Missões concluídas em sequência, lendo de trás pra frente na Timeline
  // até encontrar a primeira que não é uma conclusão — "consecutivas" no
  // sentido literal: as últimas N ações do usuário no sistema foram todas
  // fechar uma missão.
  const timelineRecente = [...ctx.timeline].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  let missõesConcluidasSeguidas = 0;
  for (const evento of timelineRecente) {
    if (evento.type !== 'missao_concluida') break;
    missõesConcluidasSeguidas += 1;
  }
  if (missõesConcluidasSeguidas >= CONSECUTIVE_MISSIONS_THRESHOLD) {
    recommendations.push({
      category: 'reconhecer_consistencia',
      message: `Você concluiu ${missõesConcluidasSeguidas} missões consecutivas. Excelente consistência.`,
    });
  }

  // Dívidas em aberto somam mais que o saldo atual — leitura conservadora
  // de fluxo de caixa: `Debt` não tem data de vencimento no modelo hoje
  // (ver `services/nova/insights`), então a Nova nunca afirma algo sobre
  // "o mês que vem" especificamente, só compara os dois totais reais que
  // já existem.
  const saldoAtual = totalReceitas - totalDespesas;
  const totalDividasAbertas = ctx.debts.reduce((sum, debt) => sum + debt.remainingAmount, 0);
  if (totalDividasAbertas > 0 && totalDividasAbertas > saldoAtual) {
    recommendations.push({
      category: 'revisar_fluxo_caixa',
      message: `Suas dívidas em aberto somam R$ ${totalDividasAbertas.toFixed(2)}, mais que seu saldo atual (R$ ${saldoAtual.toFixed(2)}) — seu fluxo de caixa merece atenção.`,
    });
  }

  // Acompanhamento: meta/projeto criado há alguns dias, ainda sem
  // conclusão. A única fonte real de "quando foi criado" é o evento
  // `missao_criada` da Timeline (`Mission` não tem `createdAt`) — casado
  // pelo mesmo título usado em `createMissionFromBlueprint`
  // (`services/nova/actions/create-mission.ts`).
  function staleMissionOf(kind: 'meta' | 'projeto'): { title: string; dias: number } | undefined {
    const candidatas = ctx.missions.filter((mission) => mission.kind === kind && mission.status !== 'concluida');
    let maisAntiga: { title: string; dias: number } | undefined;
    for (const mission of candidatas) {
      const criacao = ctx.timeline.find((evento) => evento.type === 'missao_criada' && evento.title === `Missão criada: ${mission.title}`);
      if (!criacao) continue;
      const dias = daysBetween(criacao.timestamp, today);
      if (dias >= STALE_GOAL_DAYS_THRESHOLD && (!maisAntiga || dias > maisAntiga.dias)) {
        maisAntiga = { title: mission.title, dias };
      }
    }
    return maisAntiga;
  }

  const metaParada = staleMissionOf('meta');
  if (metaParada) {
    recommendations.push({
      category: 'acompanhar_meta',
      message: `Faz ${metaParada.dias} dias que definimos a meta "${metaParada.title}". Como está o andamento?`,
    });
  }

  const projetoParado = staleMissionOf('projeto');
  if (projetoParado) {
    recommendations.push({
      category: 'acompanhar_projeto',
      message: `Você conseguiu avançar no projeto "${projetoParado.title}" desde que o criamos, há ${projetoParado.dias} dias?`,
    });
  }

  // Viagem cadastrada com início próximo.
  const viagemProxima = ctx.trips
    .filter((trip) => {
      const dias = daysBetween(today, trip.startDate);
      return dias >= 0 && dias <= UPCOMING_TRIP_DAYS_THRESHOLD;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
  if (viagemProxima) {
    recommendations.push({
      category: 'viagem_proxima',
      message: `Sua viagem para ${viagemProxima.destination} está chegando. Deseja revisar o planejamento?`,
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
  const today = toLocalDateString();
  const monthPrefix = monthPrefixOf(today);
  const despesasMes = ctx.financeEntries.filter((entry) => entry.type === 'despesa' && entry.date.startsWith(monthPrefix));
  const receitasMes = ctx.financeEntries.filter((entry) => entry.type === 'receita' && entry.date.startsWith(monthPrefix));
  const totalDespesas = despesasMes.reduce((sum, entry) => sum + entry.amount, 0);
  const totalReceitas = receitasMes.reduce((sum, entry) => sum + entry.amount, 0);
  const saldo = totalReceitas - totalDespesas;
  return `Saldo do mês: R$ ${saldo.toFixed(2)} (receitas R$ ${totalReceitas.toFixed(2)} − despesas R$ ${totalDespesas.toFixed(2)}).`;
}
