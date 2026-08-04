import type { NovaIntent } from '@/services/nova';

/**
 * Regra de "ação sensível" (CONTROL OS — Etapa 11: NOVA copiloto — "executar
 * primeiro, perguntar depois"). Antes (Etapa 4.5), dívida sempre pedia
 * confirmação e despesa/receita pediam acima de um valor — a NOVA
 * interrompia o usuário com "Confirma?" pra qualquer ação de valor mais
 * alto, mesmo sendo 100% reversível (dado errado se corrige registrando um
 * ajuste, nada é apagado). Política nova: só interrompe pra confirmação
 * quando a ação for destrutiva/irreversível (excluir, apagar, remover,
 * desconectar) — nenhum dos `NovaIntent` que existem hoje é desse tipo (só
 * há intents de CRIAR: despesa, receita, dívida, lembrete, meta, projeto,
 * hábito, viagem, documento, bem, nota — ver `packages/types`/
 * `services/nova/interfaces`), então `isSensitiveIntent` não pausa nenhuma
 * delas mais. Esta função continua existindo (não é lógica morta): é o
 * ponto único onde uma futura intent destrutiva (`excluir_documento`,
 * `remover_meta`, `desconectar_integracao`, etc., quando esses tipos forem
 * criados) deve retornar `true` — sem duplicar o mecanismo de pendência/
 * confirmação já pronto em `ConversationService`.
 */
export function isSensitiveIntent(intent: NovaIntent): boolean {
  return intent.kind === 'excluir_agenda'
    || intent.kind === 'pagar_conta_fixa'
    || intent.kind === 'criar_emprestimo'
    || intent.kind === 'criar_financiamento';
}

/** "sim", "s", "confirma", "pode", "ok", "beleza", "isso" — variações comuns de confirmação em pt-BR. */
export const CONFIRM_PATTERN = /^(sim|s|confirma(r)?|pode|ok|okay|beleza|isso|manda)[\s,!.]*$/i;

/** "não", "n", "cancela", "deixa pra lá", "esquece" — variações comuns de recusa em pt-BR. */
export const CANCEL_PATTERN = /^(n[ãa]o|n|cancela(r)?|deixa (pra )?l[áa]|esquece|para)[\s,!.]*$/i;

/** Resumo em texto mostrado antes de executar uma ação sensível, junto com os botões Confirmar/Cancelar. */
export function buildConfirmationPreview(intent: NovaIntent): string {
  switch (intent.kind) {
    case 'registrar_despesa':
      return `Vou registrar uma despesa de R$ ${intent.amount.toFixed(2)} (${intent.description}). Confirma?`;
    case 'registrar_receita':
      return `Vou registrar uma receita de R$ ${intent.amount.toFixed(2)} (${intent.description}). Confirma?`;
    case 'registrar_divida':
      return `Vou registrar uma dívida de R$ ${intent.totalAmount.toFixed(2)} em ${intent.installments}x (${intent.description}). Confirma?`;
    case 'criar_emprestimo':
      return `Vou cadastrar o empréstimo "${intent.description}", no valor de R$ ${intent.totalAmount.toFixed(2)}, em ${intent.installments}x, com vencimento no dia ${intent.dueDay}. Confirma?`;
    case 'criar_financiamento':
      return `Vou cadastrar o financiamento "${intent.description}", no valor de R$ ${intent.totalAmount.toFixed(2)}, em ${intent.installments}x, com vencimento no dia ${intent.dueDay}. Confirma?`;
    case 'excluir_agenda':
      return `Vou excluir o compromisso "${intent.title}" da agenda. Confirma?`;
    case 'pagar_conta_fixa':
      return `Vou marcar a conta "${intent.name}" como paga e registrar a movimentação financeira. Confirma?`;
    default:
      // Nunca alcançado em runtime — só chega aqui um `intent` que `isSensitiveIntent` já aprovou.
      return 'Confirma essa ação?';
  }
}

/**
 * Descrição curta e natural de qualquer `NovaIntent`, cobrindo os 12
 * domínios acionáveis — usada só por `buildBatchConfirmationPreview`
 * (CONTROL OS — Etapa 5: o raciocínio da OpenAI pode propor várias tool
 * calls no mesmo turno, ex.: "Quero viajar para Portugal" → meta + viagem +
 * lembrete; se qualquer uma delas for sensível, o lote inteiro pausa pra
 * confirmação, então o usuário precisa ver TODAS as ações propostas, não só
 * a sensível).
 */
function describeIntentForBatch(intent: NovaIntent): string {
  switch (intent.kind) {
    case 'registrar_despesa':
      return `registrar uma despesa de R$ ${intent.amount.toFixed(2)} (${intent.description})`;
    case 'registrar_receita':
      return `registrar uma receita de R$ ${intent.amount.toFixed(2)} (${intent.description})`;
    case 'transferir_conta':
      return `transferir R$ ${intent.amount.toFixed(2)} para ${intent.toAccountName}`;
    case 'parcelar_despesa':
      return `parcelar "${intent.description}" em ${intent.installments}x`;
    case 'criar_emprestimo':
      return `cadastrar o empréstimo "${intent.description}" em ${intent.installments}x`;
    case 'criar_financiamento':
      return `cadastrar o financiamento "${intent.description}" em ${intent.installments}x`;
    case 'criar_lembrete':
      return `criar o lembrete "${intent.title}"`;
    case 'criar_agenda':
      return `criar o compromisso "${intent.title}"${intent.time ? ` às ${intent.time}` : ''}`;
    case 'excluir_agenda':
      return `excluir o compromisso "${intent.title}" da agenda`;
    case 'criar_objetivo':
      return `criar a meta "${intent.title}"`;
    case 'criar_projeto':
      return `criar o projeto "${intent.title}"`;
    case 'registrar_divida':
      return `registrar uma dívida de R$ ${intent.totalAmount.toFixed(2)} em ${intent.installments}x (${intent.description})`;
    case 'criar_habito':
      return `criar o hábito "${intent.title}"`;
    case 'criar_viagem':
      return `criar a viagem para ${intent.destination} (${intent.startDate} a ${intent.endDate})`;
    case 'criar_documento':
      return `adicionar o documento "${intent.title}"`;
    case 'criar_bem':
      return `registrar o bem "${intent.name}"`;
    case 'criar_nota':
      return `criar a nota "${intent.title}"`;
    case 'pagar_conta_fixa':
      return `marcar a conta "${intent.name}" como paga`;
    case 'consultar_contas_vencendo':
      return `consultar as contas que vencem ${intent.period === 'amanha' ? 'amanhã' : 'esta semana'}`;
    case 'consultar_dividas':
    case 'consultar_dia':
    case 'desconhecido':
      // Nunca alcançado — a OpenAI nunca propõe estas como tool call (são
      // respondidas direto do contexto, sem execução — ver ConversationService).
      return 'essa ação';
  }
}

/**
 * Preview de confirmação pra um lote de tool calls propostas no mesmo turno
 * (CONTROL OS — Etapa 5). Com 1 intent só, cai no mesmo texto de
 * `buildConfirmationPreview` (mantém a UX de hoje idêntica); com mais de
 * uma, lista cada ação numa linha.
 */
export function buildBatchConfirmationPreview(intents: NovaIntent[]): string {
  const [first, ...rest] = intents;
  if (!first) return 'Confirma essa ação?';
  if (rest.length === 0) return buildConfirmationPreview(first);

  const items = intents.map((intent) => `• ${describeIntentForBatch(intent)}`).join('\n');
  return `Vou fazer o seguinte:\n${items}\nConfirma?`;
}
