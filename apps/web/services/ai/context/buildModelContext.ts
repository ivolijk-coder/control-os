import { getNovaState, toLocalDateString } from '@/services/nova';
import { buildUserMemoryProfile } from '../memory';
import type { AIConversationContext } from '../types';

/** Quantas categorias de despesa do mês entram no resumo — top N por valor total, não a lista inteira. */
const TOP_EXPENSE_CATEGORIES = 3;

/**
 * Soma o total de despesas do mês corrente por categoria, maior primeiro —
 * base real (não inventada) pra perguntas do tipo "analise meus gastos"
 * (CONTROL OS — Etapa 5). Só usa campos que existem de fato em
 * `FinanceEntry` (`category`, `amount`, `date`, `type`) — não há conceito
 * de "orçamento mensal" no modelo de dados hoje, então o resumo nunca
 * afirma nada sobre orçamento; o `SystemPrompt` também instrui a NOVA a não
 * inventar essa comparação.
 */
function topExpenseCategoriesThisMonth(ctx: AIConversationContext, monthPrefix: string): Array<{ category: string; total: number }> {
  const totals = new Map<string, number>();
  for (const entry of ctx.financeEntries) {
    if (entry.type !== 'despesa' || !entry.date.startsWith(monthPrefix)) continue;
    totals.set(entry.category, (totals.get(entry.category) ?? 0) + entry.amount);
  }
  return [...totals.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, TOP_EXPENSE_CATEGORIES);
}

/**
 * Monta o resumo compacto de contexto enviado a um provedor de IA real
 * (CONTROL OS — Etapa 4, enriquecido na Etapa 5 pra sustentar análises
 * pedidas em conversa — ex.: "analise meus gastos" — e na Etapa 6 pra
 * cobrir todo o catálogo de domínios da NOVA CORE: financeiro, agenda,
 * hábitos, metas, projetos, lembretes, dívidas, documentos, patrimônio,
 * notas, viagens e preferências). "Nunca enviar dados desnecessários" —
 * em vez de serializar os arrays inteiros (`financeEntries`, `missions`
 * etc., que podem chegar a centenas de itens numa conta madura), condensa
 * cada domínio em totais/contagens/destaques, como um humano resumiria o
 * próprio dia pra outra pessoa. `MockAIProvider` nunca usa isto — só
 * `OpenAIProvider`, ao montar o payload pra `app/api/ai/nova/route.ts`.
 *
 * Etapa 7 — IA-Native: também lê o Memory Engine (`buildUserMemoryProfile`
 * — objetivo principal, prioridades, estilo de resposta) e o NOVA State
 * (`getNovaState` — última recomendação, calculada continuamente pelo
 * `NovaObserver`, não só quando alguém pergunta). Todos os campos são
 * opcionais e só entram no texto quando preenchidos — nenhum "objetivo
 * principal: nenhum" forçado, pra não sujar o prompt com ausência de dado.
 *
 * CONTROL HUB — Fase 3 (Memory Layer): `buildUserMemoryProfile` deixou de
 * ser síncrona (agora fala com o `MemoryService` genérico, que é assíncrono
 * por design, pra suportar backends reais como Postgres/Redis no futuro) —
 * por isso esta função também precisou virar `async`. Todos os chamadores
 * (em `OpenAIProvider.ts`) já estão dentro de métodos `async` e passaram a
 * usar `await` aqui; nenhum comportamento observável mudou.
 */
export async function buildModelContextSummary(ctx: AIConversationContext): Promise<string> {
  const now = new Date();
  // Bugfix: `today` usava `new Date().toISOString().slice(0, 10)` — sempre
  // UTC, então à noite no fuso do usuário a NOVA já achava que era o dia
  // seguinte. `toLocalDateString` lê a data no fuso local real (ver
  // `services/nova/date.ts`).
  const today = toLocalDateString(now);
  const monthPrefix = today.slice(0, 7);
  const todayWeekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(now);

  const eventosHoje = ctx.agendaEvents.filter((event) => event.date === today);
  const despesasHoje = ctx.financeEntries.filter((entry) => entry.type === 'despesa' && entry.date.slice(0, 10) === today);
  const receitasHoje = ctx.financeEntries.filter((entry) => entry.type === 'receita' && entry.date.slice(0, 10) === today);
  const despesasMes = ctx.financeEntries.filter((entry) => entry.type === 'despesa' && entry.date.startsWith(monthPrefix));
  const receitasMes = ctx.financeEntries.filter((entry) => entry.type === 'receita' && entry.date.startsWith(monthPrefix));
  const totalDespesasMes = despesasMes.reduce((sum, entry) => sum + entry.amount, 0);
  const totalReceitasMes = receitasMes.reduce((sum, entry) => sum + entry.amount, 0);
  const topCategorias = topExpenseCategoriesThisMonth(ctx, monthPrefix);
  const metasAtivas = ctx.missions.filter((mission) => mission.kind === 'meta' && mission.status !== 'concluida');
  // CONTROL OS — Etapa 6: `Mission` também cobre 'projeto' e 'lembrete' (mesma fonte de dados,
  // ver `MissionKind` em packages/types) — sem essas duas linhas, a NOVA "esquecia" de projetos
  // e lembretes em pedidos de vida compostos (ex.: "quero comprar uma casa" pode virar meta +
  // projeto + lembretes, e a NOVA precisa saber o que já existe antes de propor mais).
  const projetosAtivos = ctx.missions.filter((mission) => mission.kind === 'projeto' && mission.status !== 'concluida');
  const lembretesPendentes = ctx.missions.filter((mission) => mission.kind === 'lembrete' && mission.status !== 'concluida');
  const missõesEmRisco = ctx.missions.filter((mission) => mission.status === 'em_risco');
  const habitosPendentes = ctx.habits.filter((habit) => !habit.completedToday);
  const dividasAbertas = ctx.debts.filter((debt) => debt.remainingAmount > 0);
  const proximaViagem = [...ctx.trips].sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  const lines: string[] = [
    // CONTROL OS — Etapa 14 (Execution Engine): sem esta linha, o modelo não
    // tinha como resolver "amanhã", "sexta", "semana que vem" — a NOVA tinha
    // que perguntar a data exata, ou (pior) executava com a data errada.
    // Data real do relógio do sistema, nunca inventada.
    `Hoje é ${today} (${todayWeekday}). Use esta data como referência para resolver qualquer data relativa mencionada pelo usuário (ex.: "amanhã", "sexta", "semana que vem", "mês que vem").`,
    `Usuário: ${ctx.userName}`,
    `Compromissos hoje: ${eventosHoje.length}`,
    `Despesas hoje: ${despesasHoje.length} lançamento(s)`,
    `Receitas hoje: ${receitasHoje.length} lançamento(s)`,
    `Despesas do mês: R$ ${totalDespesasMes.toFixed(2)} em ${despesasMes.length} lançamento(s)`,
    `Receitas do mês: R$ ${totalReceitasMes.toFixed(2)} em ${receitasMes.length} lançamento(s)`,
    `Saldo do mês (receitas − despesas): R$ ${(totalReceitasMes - totalDespesasMes).toFixed(2)}`,
  ];

  if (topCategorias.length > 0) {
    const categoriasTexto = topCategorias.map((item) => `${item.category} (R$ ${item.total.toFixed(2)})`).join(', ');
    lines.push(`Maiores categorias de despesa no mês: ${categoriasTexto}`);
  }

  if (ctx.agendaEvents.length > 0) {
    const agenda = [...ctx.agendaEvents]
      .sort((a, b) => `${a.date} ${a.time ?? ''}`.localeCompare(`${b.date} ${b.time ?? ''}`))
      .slice(0, 20)
      .map((event) => `id=${event.id}; título="${event.title}"; data=${event.date}${event.time ? `; horário=${event.time}` : ''}`)
      .join(' | ');
    lines.push(`Agenda (para consultar ou excluir somente por ID exato): ${agenda}`);
  }

  lines.push(
    `Metas em andamento: ${metasAtivas.length}${metasAtivas.length > 0 ? ` (ex.: "${metasAtivas[0]?.title}" em ${metasAtivas[0]?.progress}%)` : ''}`,
    `Projetos ativos: ${projetosAtivos.length}${projetosAtivos.length > 0 ? ` (ex.: "${projetosAtivos[0]?.title}" em ${projetosAtivos[0]?.progress}%)` : ''}`,
    `Lembretes pendentes: ${lembretesPendentes.length}`,
    `Missões em risco de prazo: ${missõesEmRisco.length}`,
    `Hábitos pendentes hoje: ${habitosPendentes.length} de ${ctx.habits.length}`,
    `Dívidas em aberto: ${dividasAbertas.length}`,
    `Documentos cadastrados: ${ctx.documents.length}`,
    `Bens patrimoniais cadastrados: ${ctx.assets.length}`,
    `Notas cadastradas: ${ctx.notes.length}`
  );

  if (proximaViagem) {
    lines.push(`Próxima viagem: ${proximaViagem.destination} (${proximaViagem.startDate})`);
  }
  if (ctx.preferences.length > 0) {
    lines.push(`Preferências conhecidas: ${ctx.preferences.join('; ')}`);
  }

  const memoryProfile = await buildUserMemoryProfile();
  if (memoryProfile.mainGoal) {
    lines.push(`Objetivo principal do usuário: ${memoryProfile.mainGoal}`);
  }
  if (memoryProfile.priorities.length > 0) {
    lines.push(`Prioridades conhecidas: ${memoryProfile.priorities.join('; ')}`);
  }
  if (memoryProfile.responseStyle) {
    lines.push(`Estilo de resposta preferido: ${memoryProfile.responseStyle}`);
  }

  const novaState = getNovaState();
  if (novaState.lastRecommendation) {
    lines.push(`Última recomendação gerada pela NOVA (uso interno, só mencione se fizer sentido na conversa): ${novaState.lastRecommendation}`);
  }

  return lines.join('\n');
}
