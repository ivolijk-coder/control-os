import type { NovaIntent } from '@/services/nova';

/**
 * Regra de "ação sensível" (CONTROL OS — Evolução da experiência NOVA):
 * dívidas sempre pedem confirmação (criam uma obrigação de longo prazo,
 * independente do valor); despesas/receitas só pedem confirmação acima de
 * um valor — abaixo disso a NOVA continua executando na hora, do jeito que
 * já funcionava. Lembretes, compromissos, metas, projetos e consultas nunca
 * são sensíveis: continuam 100% instantâneos.
 */
const SENSITIVE_AMOUNT_THRESHOLD = 300;

/** "sim", "s", "confirma", "pode", "ok", "beleza", "isso" — variações comuns de confirmação em pt-BR. */
export const CONFIRM_PATTERN = /^(sim|s|confirma(r)?|pode|ok|okay|beleza|isso|manda)[\s,!.]*$/i;

/** "não", "n", "cancela", "deixa pra lá", "esquece" — variações comuns de recusa em pt-BR. */
export const CANCEL_PATTERN = /^(n[ãa]o|n|cancela(r)?|deixa (pra )?l[áa]|esquece|para)[\s,!.]*$/i;

export function isSensitiveIntent(intent: NovaIntent): boolean {
  if (intent.kind === 'registrar_divida') return true;
  if (intent.kind === 'registrar_despesa' || intent.kind === 'registrar_receita') {
    return intent.amount >= SENSITIVE_AMOUNT_THRESHOLD;
  }
  return false;
}

/** Resumo em texto mostrado antes de executar uma ação sensível, junto com os botões Confirmar/Cancelar. */
export function buildConfirmationPreview(intent: NovaIntent): string {
  switch (intent.kind) {
    case 'registrar_despesa':
      return `Vou registrar uma despesa de R$ ${intent.amount.toFixed(2)} (${intent.description}). Confirma?`;
    case 'registrar_receita':
      return `Vou registrar uma receita de R$ ${intent.amount.toFixed(2)} (${intent.description}). Confirma?`;
    case 'registrar_divida':
      return `Vou registrar uma dívida de R$ ${intent.totalAmount.toFixed(2)} em ${intent.installments}x (${intent.description}). Confirma?`;
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
    case 'criar_lembrete':
      return `criar o lembrete "${intent.title}"`;
    case 'criar_agenda':
      return `criar o compromisso "${intent.title}"${intent.time ? ` às ${intent.time}` : ''}`;
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
