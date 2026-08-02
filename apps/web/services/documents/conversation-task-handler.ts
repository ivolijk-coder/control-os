import 'server-only';

import type { ConversationTask } from '@/services/conversation-tasks';
import { ConfirmationError, confirmDocumentProposal } from './document-proposal-confirmation.service';

export type DocumentConversationTaskResolution = {
  reply: string;
  financial: boolean;
  installmentGroupId?: string | null;
  /**
   * `true` quando `confirmDocumentProposal` encontrou a proposta já
   * `CONFIRMED` (idempotência do service — Fase A) em vez de criar agora.
   * A rota usa isto pra NUNCA auditar `FINANCIAL_ENTITY_CREATED` de novo
   * numa repetição (clique duplo já resolvido em outra aba, mensagem
   * repetida, etc.) — a entidade não foi criada nesta chamada, só
   * confirmada como já existente.
   */
  alreadyConfirmed?: boolean;
};

/**
 * Handler de resolução de `ConversationTask` para documentos (Fase E —
 * "NOVA como centro da experiência"). Ponto de extensão reservado pela
 * Fase D em `app/api/nova/conversation-tasks/[id]/resolve/route.ts`: só
 * entra em jogo quando `task.sourceType === 'document_import_proposal'`;
 * qualquer outro `sourceType` (produtores futuros) passa direto pela
 * conclusão genérica da rota, sem tocar este arquivo.
 *
 * "IA sugere -> ConversationTask -> usuário confirma -> Action validada
 * -> Service executa": este handler NUNCA cria o financiamento sozinho —
 * só valida o que o usuário escolheu e delega pro MESMO
 * `DocumentProposalConfirmationService` que a tela de Documentos usa
 * (Fase A). `proposalId` vem do `payload` gravado na Fase C, mas quem
 * decide se ainda é confirmável é sempre `confirmDocumentProposal`
 * buscando o `DocumentImportProposal` atual de novo — o `payload`
 * congelado da task nunca é a fonte de verdade sobre dinheiro (a
 * proposta pode ter sido confirmada ou descartada em Documentos entre a
 * criação da task e agora).
 *
 * Devolve `null` quando `actionId` não é reconhecido — a rota decide o
 * que fazer nesse caso (hoje, conclui genericamente).
 */
export async function resolveDocumentConversationTaskAction(
  task: ConversationTask,
  actionId: string,
  userId: string,
  fields: { accountId?: string; categoryId?: string; startDate?: string }
): Promise<DocumentConversationTaskResolution | null> {
  if (task.sourceType !== 'document_import_proposal') return null;
  const proposalId = typeof task.payload.proposalId === 'string' ? task.payload.proposalId : undefined;

  if (actionId === 'cadastrar_financiamento') {
    if (!proposalId) throw new ConfirmationError(422, 'Não encontrei a proposta associada a esta conversa.');
    if (!fields.accountId || !fields.categoryId) throw new ConfirmationError(400, 'Escolha a conta e a categoria antes de confirmar.');
    const outcome = await confirmDocumentProposal({
      proposalId,
      userId,
      accountId: fields.accountId,
      categoryId: fields.categoryId,
      startDate: fields.startDate,
    });
    return {
      financial: true,
      installmentGroupId: outcome.installmentGroupId,
      alreadyConfirmed: outcome.alreadyConfirmed,
      reply: outcome.alreadyConfirmed
        ? 'Esse financiamento já tinha sido cadastrado antes — não criei de novo.'
        : `Cadastrado! ${outcome.message}`,
    };
  }

  if (actionId === 'guardar_documento') {
    return { financial: false, reply: 'Certo, o documento continua guardado — não criei nada financeiro.' };
  }

  if (actionId === 'revisar_documento') {
    return { financial: false, reply: 'Tudo bem, o documento continua em Documentos pra você revisar com calma.' };
  }

  if (actionId === 'ver_documento') {
    return { financial: false, reply: 'Você pode ver os detalhes completos em Documentos quando quiser.' };
  }

  return null;
}
