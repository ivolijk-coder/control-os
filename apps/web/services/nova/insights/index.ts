import type { NovaReadOnlyContext } from '../interfaces';
import { generateRecommendations } from '../recommendations';

/** Nº máximo de bullets mostrados na Home — mesmo espírito de "resumo", nunca uma lista longa. */
const MAX_HOME_INSIGHTS = 5;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Resumo inteligente da Home (CONTROL OS — Etapa 9: NOVA Experience — "a
 * NOVA passa a ser o centro do CONTROL OS"). Gera as frases reais que
 * aparecem sob a saudação sempre que o usuário abre o sistema — nunca
 * genéricas, sempre calculadas a partir de `NovaReadOnlyContext` (o mesmo
 * contexto real que a conversa usa).
 *
 * Reaproveita o Recommendation Engine (`generateRecommendations`, Etapa 7)
 * pra sugestão final — "nunca sugestões aleatórias, sempre baseadas nos
 * dados" — em vez de reimplementar essa heurística aqui. As demais linhas
 * são específicas do formato de bullet da Home (frases curtas, uma por
 * domínio) e não duplicam nenhuma regra de negócio já existente — cada uma é
 * um filtro trivial sobre um campo real (mesmo padrão já repetido em
 * `buildTodayHighlights`/`buildModelContextSummary`/`generateRecommendations`
 * — nunca inventa um conceito novo, ex.: nunca compara com um "orçamento" ou
 * um "patrimônio histórico" que não existe no modelo de dados hoje).
 *
 * Deliberadamente NÃO inclui: variação de patrimônio ("seu patrimônio
 * aumentou") — não há snapshot histórico de valor de bens, só o total atual,
 * então não há como afirmar isso sem inventar dado; e "contas vencendo
 * amanhã" — `Debt` não tem campo de data de vencimento no modelo hoje. Os
 * dois ficam como extensão natural futura, quando esses dados existirem.
 */
export function buildHomeInsights(ctx: NovaReadOnlyContext): string[] {
  const bullets: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - MS_PER_DAY).toISOString().slice(0, 10);

  // Despesas de hoje vs ontem — só compara quando os dois dias têm
  // lançamento real (nunca compara com uma base vazia/inventada).
  const despesasHoje = ctx.financeEntries.filter((entry) => entry.type === 'despesa' && entry.date.slice(0, 10) === today);
  const despesasOntem = ctx.financeEntries.filter((entry) => entry.type === 'despesa' && entry.date.slice(0, 10) === yesterday);
  if (despesasHoje.length > 0 && despesasOntem.length > 0) {
    const totalHoje = despesasHoje.reduce((sum, entry) => sum + entry.amount, 0);
    const totalOntem = despesasOntem.reduce((sum, entry) => sum + entry.amount, 0);
    if (totalHoje < totalOntem) bullets.push('Você gastou menos do que ontem.');
    else if (totalHoje > totalOntem) bullets.push('Você gastou mais do que ontem.');
  }

  // Hábitos pendentes hoje.
  if (ctx.habits.length > 0) {
    const habitosPendentes = ctx.habits.filter((habit) => !habit.completedToday);
    bullets.push(
      habitosPendentes.length > 0
        ? `Ainda falta${habitosPendentes.length > 1 ? 'm' : ''} ${habitosPendentes.length} hábito${habitosPendentes.length > 1 ? 's' : ''} hoje.`
        : 'Você completou todos os hábitos hoje.'
    );
  }

  // Meta ativa com maior progresso.
  const metaEmDestaque = [...ctx.missions]
    .filter((mission) => mission.kind === 'meta' && mission.status !== 'concluida')
    .sort((a, b) => b.progress - a.progress)[0];
  if (metaEmDestaque) {
    bullets.push(`Sua meta "${metaEmDestaque.title}" está em ${metaEmDestaque.progress}%.`);
  }

  // Próximo compromisso de hoje.
  const proximoEvento = [...ctx.agendaEvents]
    .filter((event) => event.date === today)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))[0];
  if (proximoEvento) {
    bullets.push(
      proximoEvento.time ? `Você tem "${proximoEvento.title}" às ${proximoEvento.time}.` : `Você tem "${proximoEvento.title}" hoje.`
    );
  }

  // Sugestão real (Recommendation Engine) — a mais relevante do momento.
  const [topRecommendation] = generateRecommendations(ctx);
  if (topRecommendation) {
    bullets.push(`Tenho uma sugestão: ${topRecommendation.message}`);
  }

  return bullets.slice(0, MAX_HOME_INSIGHTS);
}
