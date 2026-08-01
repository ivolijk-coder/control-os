import type { DocumentInsight } from '../interfaces';

/**
 * Ponte Documentos -> NOVA: transforma um `DocumentInsight` (projeção de
 * `DocumentImportProposal.extractedData`, ver `interfaces/index.ts`) numa
 * única frase que a Nova pode "falar" — usada por
 * `generateRecommendations`/`buildProactiveOpening` (categoria
 * `documento_analisado`). 100% local e determinístico, igual às demais
 * heurísticas de `services/nova/recommendations` — nunca chama a OpenAI,
 * nunca decide nem executa nada financeiro: só descreve o que já está
 * guardado e convida o usuário a confirmar em Documentos, onde o fluxo
 * atual de confirmação (`confirm/route.ts`, conta + categoria escolhidas
 * pelo usuário) continua intocado.
 *
 * `services/nova` não importa de `apps/web/lib/utils` de propósito (mesma
 * regra de portabilidade de `debts-summary.ts`/`daily-checkin.ts`), por
 * isso o formatador de BRL é local.
 */
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CONTRACT_SOCIAL: 'um Contrato Social',
  FINANCING_CONTRACT: 'um contrato de financiamento',
  LOAN_CONTRACT: 'um contrato de empréstimo',
  INVOICE: 'uma nota fiscal',
  RECEIPT: 'um recibo',
  PAYMENT_PROOF: 'um comprovante de pagamento',
  TAX_DOCUMENT: 'um documento fiscal',
  PERSONAL_DOCUMENT: 'um documento pessoal',
  LEGAL_DOCUMENT: 'um documento jurídico',
  OTHER: 'um documento',
};

/**
 * Mesmo critério de "dado mínimo de crédito" usado por
 * `isFinancialInstallmentProposal` no backend (credor, valor e parcelas) —
 * só quando os três estão presentes é que vale a pena a Nova já convidar
 * pro cadastro; caso contrário ela só descreve o que entendeu, sem inventar
 * um valor que a IA não confirmou.
 */
function hasMinimumCreditData(insight: DocumentInsight): boolean {
  const { financialOperation } = insight;
  return financialOperation.detected === true
    && Boolean(financialOperation.creditor)
    && financialOperation.amount != null
    && financialOperation.installments != null
    && financialOperation.installments > 0;
}

export function buildDocumentInsightMessage(insight: DocumentInsight): string {
  if (hasMinimumCreditData(insight)) {
    const { financialOperation } = insight;
    const tipo = financialOperation.type ? financialOperation.type.toLocaleLowerCase('pt-BR').replace(/_/g, ' ') : 'financiamento';
    return `Analisei seu documento e identifiquei ${tipo} ${financialOperation.creditor} de ${formatBRL(financialOperation.amount as number)} em ${financialOperation.installments}x. Quer que eu prepare o cadastro? Confirme em Documentos — nada financeiro é criado sem sua confirmação lá.`;
  }

  const tipoLabel = DOCUMENT_TYPE_LABELS[insight.documentType] ?? 'um documento';
  const acaoSugerida = insight.suggestedActions[0];
  const resumo = insight.summary ? ` ${insight.summary}` : '';
  return `Analisei ${tipoLabel} que você guardou.${resumo}${acaoSugerida ? ` ${acaoSugerida}` : ' Dá uma olhada em Documentos quando puder.'}`;
}
