import 'server-only';

import { LLMProviderError, OpenAILLMProvider, type LLMProvider } from '@/services/llm';
import { buildNovaReadOnlyPrompt, type NovaReadOnlyPromptInput } from './nova-read-only-prompt';

/**
 * `responseProvider` somente-leitura da NOVA (PR10.4).
 *
 * Escolha de substrato: `services/llm` (`LLMProvider`/`OpenAILLMProvider`),
 * e não a rota legada `POST /api/ai/nova`. O motivo é de contenção, não de
 * conveniência — a rota legada envia `INTENT_TOOL_SCHEMAS` (19 tools, 17
 * delas de mutação), enquanto esta camada nunca envia `tools`. Reusá-la
 * torna estruturalmente impossível que este caminho proponha execução de
 * ação, mesmo sob prompt injection. É garantia arquitetural, não disciplina.
 *
 * PORTA TEMPORÁRIA E DELIBERADAMENTE ESTREITA. Não é a porta oficial
 * `ResponseProvider` declarada em `nova-orchestrator.interfaces.ts`, e a
 * decisão foi tomada por três motivos auditados, não por conveniência:
 *
 *   1. A porta oficial NÃO TEM `history`. Sua assinatura é
 *      `compose({ identity, context, userMessage, actionRequests,
 *      actionResults })` — não existe campo para as mensagens anteriores da
 *      conversa, que este fluxo precisa para responder follow-ups. Adotá-la
 *      como está exigiria abrir mão do histórico ou alterar o contrato
 *      declarado no PR #13; nenhuma das duas coisas é convergência.
 *
 *   2. Ela exporia identidade e payload de ação a um composer que não usa
 *      nem uma coisa nem outra. `NovaTurnIdentity` carrega `turnId`,
 *      `clientTurnId` e `userId`; hoje o tipo de entrada do prompt
 *      (`NovaReadOnlyPromptInput`) é estruturalmente incapaz de receber
 *      identificador, e é isso que torna a garantia "nenhum identificador
 *      chega ao provedor externo" uma propriedade do tipo em vez de uma
 *      convenção. `actionRequests`/`actionResults` seriam sempre arrays
 *      vazios — indistinguíveis de "as ações rodaram e não produziram
 *      nada", o que apaga do tipo o fato de que este fluxo nunca executa.
 *
 *   3. O retorno oficial (`{ content, provider, providerResponseId }`) não
 *      tem destino aqui: `completeReadOnlyTurn` não persiste `provider` nem
 *      `providerResponseId`.
 *
 * CONVERGÊNCIA: na etapa 10.6, quando a execução idempotente de ações
 * entrar, a porta final deve ser REDESENHADA a partir das necessidades
 * reais já conhecidas — histórico, identidade e ações — e esta interface
 * então desaparece, absorvida por ela. Até lá, o tipo reflete exatamente o
 * que o fluxo faz, e nada além disso.
 */
export interface NovaReadOnlyResponseProvider {
  compose(input: NovaReadOnlyPromptInput): Promise<string>;
}

export class NovaLlmReadOnlyResponseProvider implements NovaReadOnlyResponseProvider {
  constructor(private readonly llm: LLMProvider = new OpenAILLMProvider()) {}

  async compose(input: NovaReadOnlyPromptInput): Promise<string> {
    const { content } = await this.llm.complete({
      prompt: buildNovaReadOnlyPrompt(input),
      format: 'text',
    });
    const reply = content.trim();
    // Resposta vazia é falha, não silêncio: o turno precisa terminar em
    // FAILED explícito em vez de gravar uma mensagem em branco no histórico.
    if (!reply) throw new LLMProviderError('invalid_response', 'O provedor devolveu resposta vazia.');
    return reply;
  }
}

export const novaReadOnlyResponseProvider: NovaReadOnlyResponseProvider = new NovaLlmReadOnlyResponseProvider();
