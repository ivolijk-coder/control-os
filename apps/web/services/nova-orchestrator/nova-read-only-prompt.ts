import { buildSystemPrompt } from '@/services/ai/prompts';
import { sanitizeConversationContent } from '@/services/nova-conversations/conversation-content-sanitizer';
import type { UserContext } from '@/services/context-provider';

/**
 * Montagem determinística do prompt somente-leitura da NOVA (PR10.4).
 *
 * Função PURA e sem I/O de propósito: o que é enviado a um provedor externo
 * precisa ser inteiramente auditável em teste unitário, sem rede e sem
 * banco. Quem busca contexto é o serviço; aqui só se formata o que já
 * chegou.
 *
 * Duas regras estruturais que este módulo garante e que os testes cobrem:
 *
 *   1. TODO texto de origem humana — mensagem atual e histórico — passa por
 *      `sanitizeConversationContent` ANTES de entrar no prompt. A
 *      sanitização na persistência (`completeReadOnlyTurn`) continua
 *      existindo e não substitui esta: sem a daqui, um segredo colado pelo
 *      usuário ficaria redigido no banco e ainda assim vazaria ao provedor,
 *      porque o envio acontece antes da gravação.
 *
 *   2. Nenhum identificador interno entra no prompt. `userId`,
 *      `conversationId`, `turnId` e `clientTurnId` são deliberadamente
 *      ausentes da entrada desta função — o modelo recebe fatos, nunca
 *      identidade nem chave de correlação.
 */

export type NovaReadOnlyPersona = 'NOVA' | 'LEGENDARY';

export interface NovaReadOnlyPromptMessage {
  readonly role: 'USER' | 'ASSISTANT';
  readonly content: string;
}

export interface NovaReadOnlyPromptInput {
  readonly persona: NovaReadOnlyPersona;
  readonly message: string;
  readonly context: UserContext;
  readonly history: readonly NovaReadOnlyPromptMessage[];
}

/** Teto de turnos do histórico enviados ao provedor. Custo previsível por turno. */
const HISTORY_LIMIT = 10;

/**
 * Contrato somente-leitura declarado ao modelo. É defesa em profundidade,
 * não a defesa principal: a contenção real é estrutural — o roteamento
 * determinístico (`routeNovaReadOnlyMessage`) desvia mutações para
 * `BLOCKED_MUTATION` antes de qualquer chamada ao provedor, e a camada
 * `services/llm` nunca envia `tools`, então o modelo não tem como propor
 * execução mesmo que o texto abaixo fosse ignorado.
 */
const READ_ONLY_CONTRACT = [
  '## Restrição desta sessão',
  'Você está respondendo por um canal SOMENTE LEITURA do CONTROL OS.',
  'Você não executa, não cria, não altera, não exclui e não confirma nada.',
  'Se o pedido exigir qualquer alteração, diga com clareza que este fluxo não realiza alterações e que nada foi feito.',
  'Responda apenas com base no contexto factual abaixo e no histórico. Não invente valores, datas, saldos ou compromissos.',
  'Se a informação necessária não estiver no contexto, diga que não tem esse dado disponível aqui.',
].join('\n');

function sanitize(text: string): string {
  return sanitizeConversationContent(text).content;
}

function describeContext(context: UserContext): string {
  const lines: string[] = [
    `Data de referência: ${context.runtime.referenceDate} (${context.runtime.timezone}).`,
    context.profile ? `Usuário autenticado: ${sanitize(context.profile.name)}.` : 'Nome do usuário: não disponível.',
  ];

  lines.push(
    context.documents
      ? `Documentos: ${context.documents.total} no total, ${context.documents.pendingAnalysis} aguardando análise, ${context.documents.failedAnalysis} com falha.`
      : 'Documentos: não disponível.'
  );
  lines.push(
    context.operationalTasks
      ? `Tarefas operacionais: ${context.operationalTasks.pending} pendentes, ${context.operationalTasks.waitingUser} aguardando o usuário.`
      : 'Tarefas operacionais: não disponível.'
  );

  const unavailable = context.coverage
    .filter((entry) => entry.status !== 'AVAILABLE')
    .map((entry) => `${entry.domain}=${entry.status}`);
  if (unavailable.length > 0) {
    lines.push(`Domínios sem dado disponível agora: ${unavailable.join(', ')}. Não preencha essas lacunas com suposições.`);
  }

  return ['## Contexto factual (fonte autenticada do servidor)', ...lines].join('\n');
}

function describeHistory(history: readonly NovaReadOnlyPromptMessage[]): string {
  const recent = history.slice(-HISTORY_LIMIT);
  if (recent.length === 0) return '## Histórico recente\nNenhuma mensagem anterior nesta conversa.';
  const lines = recent.map((message) => `${message.role === 'USER' ? 'USUÁRIO' : 'ASSISTENTE'}: ${sanitize(message.content)}`);
  return ['## Histórico recente', ...lines].join('\n');
}

export function buildNovaReadOnlyPrompt(input: NovaReadOnlyPromptInput): string {
  return [
    buildSystemPrompt(input.persona === 'LEGENDARY' ? 'legendary' : 'nova'),
    READ_ONLY_CONTRACT,
    describeContext(input.context),
    describeHistory(input.history),
    `## Mensagem atual do usuário\n${sanitize(input.message)}`,
  ].join('\n\n');
}
