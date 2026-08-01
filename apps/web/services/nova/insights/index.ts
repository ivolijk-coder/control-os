import { toLocalDateString } from '../date';
import type { NovaReadOnlyContext } from '../interfaces';
import { generateRecommendations, type NovaRecommendationCategory } from '../recommendations';

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
  // Bugfix: extração de data em UTC (`toISOString().slice(0, 10)`) fazia a
  // NOVA achar que já era o dia seguinte à noite no fuso do usuário — ver
  // `services/nova/date.ts`.
  const today = toLocalDateString();
  const yesterday = toLocalDateString(new Date(Date.now() - MS_PER_DAY));

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

/**
 * Ordem de prioridade de `buildProactiveOpening` — do que mais precisa de
 * atenção agora (fluxo de caixa, algo em risco) até o que é só continuidade
 * ("como está aquele projeto?") ou reconhecimento positivo. Intencionalmente
 * uma lista separada da ordem em que `generateRecommendations` empurra pro
 * array (aquela é a ordem dos pills de sugestão, otimizada pra variedade;
 * esta é a ordem de "o que vale mais a pena a Nova falar primeiro, sozinha,
 * sem ser perguntada").
 */
const PROACTIVE_OPENING_PRIORITY: NovaRecommendationCategory[] = [
  // 'documento_analisado' foi retirada nesta evolução: documento analisado
  // agora é uma `ConversationTask` (ver `services/conversation-tasks`),
  // apresentada pela NOVA por um caminho próprio (Fase D), fora do
  // Recommendation Engine — os dois mecanismos nunca coexistem.
  'revisar_fluxo_caixa',
  'priorizar_tarefas',
  'acompanhar_meta',
  'acompanhar_projeto',
  'viagem_proxima',
  'antecipar_metas',
  'reconhecer_consistencia',
  'gasto_semanal_alto',
  'reduzir_gastos',
  'revisar_gastos',
  'retomar_registro',
  'reorganizar_agenda',
  'concluir_habitos',
];

/**
 * NOVA Proativa (CONTROL OS — Etapa 13): a frase com que a Nova "abre" a
 * conversa sozinha, antes de qualquer pergunta do usuário — só quando existe
 * um motivo real pra isso ("sempre existir um motivo pra falar. Jamais
 * enviar mensagens sem contexto"). Reaproveita 100% o Recommendation Engine
 * (`generateRecommendations`) em vez de duplicar heurística nova — a única
 * coisa própria daqui é a ordem de prioridade (`PROACTIVE_OPENING_PRIORITY`)
 * e o fato de devolver no máximo UMA frase (nunca uma lista — abrir a
 * conversa com uma lista de avisos é o oposto de "não ser invasiva").
 *
 * Deliberadamente NÃO passa pelo `ConversationService` nem por nenhum
 * provedor de IA — é texto local, determinístico, calculado só a partir de
 * `NovaReadOnlyContext`, chamado uma única vez por `NovaWorkspace` quando a
 * conversa ainda está vazia (ver comentário lá). `null` quando nada no
 * momento justifica a Nova falar primeiro — nunca preenche o silêncio com
 * uma frase genérica.
 */
export function buildProactiveOpening(ctx: NovaReadOnlyContext): string | null {
  const recommendations = generateRecommendations(ctx);
  if (recommendations.length === 0) return null;

  for (const category of PROACTIVE_OPENING_PRIORITY) {
    const match = recommendations.find((recommendation) => recommendation.category === category);
    if (match) return match.message;
  }

  // Categoria nova que ainda não entrou na lista de prioridade acima —
  // melhor abrir com ela do que ficar em silêncio (ela já passou por toda
  // a checagem de dado real do Recommendation Engine).
  return recommendations[0]?.message ?? null;
}
