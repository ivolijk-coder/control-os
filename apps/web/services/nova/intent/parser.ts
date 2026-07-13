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

const EXPENSE_PATTERN = /\b(gastei|paguei|comprei)\b/;
const REVENUE_PATTERN = /\b(recebi|faturei|caiu|entrou)\b/;
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
