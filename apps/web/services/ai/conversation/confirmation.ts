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
