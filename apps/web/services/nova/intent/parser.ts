import type { NovaIntent } from '../interfaces';

/**
 * Parser de intenção determinístico (regex), sem IA real — substitui o
 * antigo gerador de respostas mockado local. Serve como arquitetura de referência
 * para a etapa futura em que um modelo real interpreta a mensagem; a
 * interface pública (`parseIntent(text) => NovaIntent`) não muda quando
 * isso acontecer.
 */

const AMOUNT_PATTERN = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:\.\d{1,2})?)/;
const TIME_PATTERN = /(\d{1,2})[h:](\d{2})?/;

// "passei" adicionado na Fase 7 — "Passei R$ 80 no posto." é um dos
// resultados esperados explicitamente listados para o módulo Financeiro.
// Além dos verbos no passado, aceita a forma comum de comando de WhatsApp:
// "registrar gasto 20 almoço". O valor ainda é obrigatório antes de criar
// a despesa, então palavras soltas como "gasto" não viram lançamento.
const EXPENSE_PATTERN = /\b(gastei|paguei|comprei|passei|registr(?:ar|e|a)\s+(?:uma?\s+)?(?:despesa|gasto))\b/;
const REVENUE_PATTERN = /\b(recebi|faturei|caiu|entrou)\b/;
// Fase 7 (Financeiro completo). "Transferi", "transferir", "transfira" —
// nunca colide com EXPENSE/REVENUE_PATTERN (nenhum verbo em comum).
const TRANSFER_PATTERN = /\b(transferi|transferir|transfira|fa[çc]o uma transfer[êe]ncia)\b/;
// Captura o destino depois de "para (o/a) <conta>" — ex.: "para o Nubank",
// "para a Poupança". Ancorado no fim da frase (só remove pontuação final).
const TRANSFER_TARGET_PATTERN = /\bpara\s+(?:o|a|os|as)?\s*([a-zà-ÿA-ZÀ-Ÿ0-9][a-zà-ÿA-ZÀ-Ÿ0-9\s]*?)\s*[.!?]*$/i;
// Fase 7. Formas de comando/infinitivo ("parcela", "parcelar") — deliberadamente
// distinto de DEBT_PATTERN ("parcelei", passado), sem colisão de regex.
const INSTALLMENT_COMMAND_PATTERN = /\b(parcela|parcelar|quero parcelar)\b/;
const REMINDER_PATTERN = /\b(lembrar de|lembra de|n[ãa]o esquecer de)\b/;
const AGENDA_PATTERN = /\b(reuni[ãa]o|compromisso|agendar|consulta|dentista|m[ée]dico)\b/;
const GOAL_PATTERN = /\b(quero faturar|minha meta [ée]|meu objetivo [ée]|quero alcan[çc]ar|quero economizar|quero emagrecer|quero perder)\b/;
const PROJECT_PATTERN = /\b(vou viajar|novo projeto|quero criar um projeto|vou criar)\b/;
// Checada antes de DEBT_PATTERN — "quanto eu devo" também contém "devo".
const CONSULT_DEBT_PATTERN = /\b(quanto (eu )?devo|minhas d[íi]vidas|como est[ãa]o (as )?minhas d[íi]vidas)\b/;
// `\bdevo\b\s*(r\$|\d)` fica fora do grupo com `\b` final — depois de "r$"
// (símbolo, não letra) o `\b` de fechamento nunca bateria.
const DEBT_PATTERN = /\b(tenho uma d[íi]vida|financiei|parcelei)\b|\bdevo\b\s*(r\$|\d)/;
const INSTALLMENTS_PATTERN = /(\d{1,2})\s*(?:x\b|vezes)/i;
const DAY_PLAN_PATTERN =
  /\b(o que (eu )?preciso fazer hoje|organize meu dia|como est[áa] meu dia|plano do dia|meu dia hoje)\b/;
// Só considera saudação quando é A mensagem inteira (ex.: "oi", "bom dia!")
// — evita engolir o resto do intent de uma frase como "boa tarde, gastei 50".
const GREETING_PATTERN = /^(oi+|ol[áa]|bom dia|boa tarde|boa noite|e a[íi]|hey|hello)[\s,!.]*$/i;

/**
 * Normaliza um valor em formato pt-BR ("2.500,50", "2.500", "35") para
 * número. Exportada — reaproveitada por
 * `services/ai/providers/MockAIProvider.ts` (`extractEntities`) em vez de
 * duplicar a lógica de parsing de valor monetário.
 */
export function parseAmount(text: string): number | null {
  const match = AMOUNT_PATTERN.exec(text);
  const rawValue = match?.[1];
  if (!rawValue) return null;

  let normalized: string;
  if (rawValue.includes(',')) {
    normalized = rawValue.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(rawValue)) {
    normalized = rawValue.replace(/\./g, '');
  } else {
    normalized = rawValue;
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

/**
 * Extrai um horário "HH:MM" de expressões como "15h", "15h30" ou "15:30".
 * Exportada pelo mesmo motivo de `parseAmount` — reaproveitada por
 * `MockAIProvider.extractEntities`.
 */
export function parseTime(text: string): string | undefined {
  const match = TIME_PATTERN.exec(text);
  const hour = match?.[1];
  if (!hour) return undefined;
  const minute = match?.[2] ?? '00';
  return `${hour.padStart(2, '0')}:${minute}`;
}

/** Extrai o número de parcelas de expressões como "em 10x" ou "12 vezes" — padrão 1x (à vista) se ausente. */
function parseInstallments(text: string): number {
  const match = INSTALLMENTS_PATTERN.exec(text);
  const rawValue = match?.[1];
  const parsed = rawValue ? Number(rawValue) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

/** Usa o texto original como título/descrição — capitaliza e remove pontuação final. */
function describeEntry(raw: string): string {
  const trimmed = raw.trim().replace(/[.!?]+$/, '');
  const firstChar = trimmed.charAt(0);
  return firstChar ? firstChar.toUpperCase() + trimmed.slice(1) : trimmed;
}

/**
 * Extrai o nome da conta de destino de uma transferência ("transferi 500
 * para o Nubank" -> "Nubank"). Retorna `undefined` quando a frase não traz
 * um destino claro — `FinanceService.resolveAccountId` decide o fallback.
 */
function extractTransferTarget(raw: string): string | undefined {
  const match = TRANSFER_TARGET_PATTERN.exec(raw);
  const captured = match?.[1]?.trim();
  return captured ? describeEntry(captured) : undefined;
}

export function parseIntent(text: string): NovaIntent {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  if (GREETING_PATTERN.test(raw) || DAY_PLAN_PATTERN.test(lower)) {
    return { kind: 'consultar_dia', raw };
  }

  if (EXPENSE_PATTERN.test(lower)) {
    const amount = parseAmount(raw);
    if (amount !== null) {
      return { kind: 'registrar_despesa', raw, amount, description: describeEntry(raw) };
    }
  }

  if (REVENUE_PATTERN.test(lower)) {
    const amount = parseAmount(raw);
    if (amount !== null) {
      return { kind: 'registrar_receita', raw, amount, description: describeEntry(raw) };
    }
  }

  if (TRANSFER_PATTERN.test(lower)) {
    const amount = parseAmount(raw);
    const toAccountName = extractTransferTarget(raw);
    if (amount !== null && toAccountName) {
      return { kind: 'transferir_conta', raw, amount, toAccountName };
    }
  }

  if (INSTALLMENT_COMMAND_PATTERN.test(lower)) {
    // Remove o trecho "10x"/"12 vezes" ANTES de procurar o valor — senão
    // `parseAmount` capturaria o "10" de "10x" como se fosse o preço.
    // Consequência assumida: "Parcela esse notebook em 10x." (sem preço
    // explícito) não tem valor pra extrair e cai em 'desconhecido' — a
    // NOVA precisa que o preço apareça na frase (ex.: "...de 1200 em 10x.").
    const totalAmount = parseAmount(raw.replace(INSTALLMENTS_PATTERN, ''));
    if (totalAmount !== null) {
      return {
        kind: 'parcelar_despesa',
        raw,
        totalAmount,
        installments: parseInstallments(raw),
        description: describeEntry(raw),
      };
    }
  }

  if (REMINDER_PATTERN.test(lower)) {
    return { kind: 'criar_lembrete', raw, title: describeEntry(raw) };
  }

  if (AGENDA_PATTERN.test(lower)) {
    return { kind: 'criar_agenda', raw, title: describeEntry(raw), time: parseTime(raw) };
  }

  if (GOAL_PATTERN.test(lower)) {
    return { kind: 'criar_objetivo', raw, title: describeEntry(raw) };
  }

  if (PROJECT_PATTERN.test(lower)) {
    return { kind: 'criar_projeto', raw, title: describeEntry(raw) };
  }

  if (CONSULT_DEBT_PATTERN.test(lower)) {
    return { kind: 'consultar_dividas', raw };
  }

  if (DEBT_PATTERN.test(lower)) {
    const amount = parseAmount(raw);
    if (amount !== null) {
      return {
        kind: 'registrar_divida',
        raw,
        totalAmount: amount,
        installments: parseInstallments(raw),
        description: describeEntry(raw),
      };
    }
  }

  return { kind: 'desconhecido', raw };
}
