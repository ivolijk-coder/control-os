import { LLMProviderError, OpenAILLMProvider } from '@/services/llm';
import type { LLMProvider } from '@/services/llm';
import type { DecisionEngine, DecisionResult, HubMessage } from '@/services/control-hub';
import type { UserContext } from '@/services/context-provider';
import { capabilityRegistry } from './capability-registry';
import type { CapabilityRegistry } from './capability-registry';
import { DecisionPromptBuilder } from './prompt-builder';
import type { PromptBuilder } from './prompt-builder';
import { parseLLMDecisionResponse } from './parse-llm-decision';
import { logDecisionEngineTiming } from './metrics';

/**
 * `OpenAIDecisionProvider` — CONTROL HUB Fase 5, o segundo dos "dois modos"
 * pedidos ("MockDecisionProvider e OpenAIDecisionProvider... trocar entre
 * eles apenas por configuração"). Implementa a MESMA interface
 * `DecisionEngine` de sempre (`decide(message, context): Promise<DecisionResult>`)
 * — nenhum outro módulo do CONTROL HUB precisa saber que este, e não o
 * mock, está ativo.
 *
 * Orquestra a nova camada de inteligência, cada peça já testável sozinha:
 *   1. `PromptBuilder.build` — monta o prompt (Capabilities + UserContext +
 *      Memory + mensagem atual). Este provider NUNCA monta prompt na mão.
 *   2. `LLMProvider.complete` — fala com o modelo (injeta `OpenAILLMProvider`
 *      por padrão; trocar de provedor de IA é passar outra implementação
 *      aqui, nenhuma linha deste arquivo muda).
 *   3. `parseLLMDecisionResponse` — valida a resposta bruta e devolve um
 *      `DecisionResult` seguro.
 *
 * "Nunca permitir que o fluxo quebre" — qualquer falha do `LLMProvider`
 * (rede, timeout, rate limit, API indisponível) é capturada aqui e vira um
 * `DecisionResult` de `reply` amigável, nunca uma exceção não tratada
 * subindo até `ControlHubService`. Falhas de VALIDAÇÃO (JSON inválido,
 * Action inexistente, parâmetro faltando) já são tratadas dentro de
 * `parseLLMDecisionResponse`, que também nunca lança.
 */
export class OpenAIDecisionProvider implements DecisionEngine {
  constructor(
    private readonly llmProvider: LLMProvider = new OpenAILLMProvider(),
    private readonly promptBuilder: PromptBuilder = new DecisionPromptBuilder(),
    private readonly capabilities: CapabilityRegistry = capabilityRegistry
  ) {}

  async decide(message: HubMessage, context: UserContext): Promise<DecisionResult> {
    const startedAt = Date.now();

    const promptStartedAt = Date.now();
    const prompt = await this.promptBuilder.build(message, context);
    const promptBuildMs = Date.now() - promptStartedAt;

    const llmStartedAt = Date.now();
    let content: string;
    try {
      const response = await this.llmProvider.complete({ prompt });
      content = response.content;
    } catch (error) {
      logDecisionEngineTiming({
        promptBuildMs,
        llmCallMs: Date.now() - llmStartedAt,
        validationMs: 0,
        totalMs: Date.now() - startedAt,
      });
      return { kind: 'reply', reply: friendlyMessageFor(error), actions: [] };
    }
    const llmCallMs = Date.now() - llmStartedAt;

    const validationStartedAt = Date.now();
    const result = parseLLMDecisionResponse(content, this.capabilities);
    const validationMs = Date.now() - validationStartedAt;

    logDecisionEngineTiming({ promptBuildMs, llmCallMs, validationMs, totalMs: Date.now() - startedAt });
    return result;
  }
}

/** Mensagens amigáveis por código de erro do `LLMProvider` — mesmo espírito de `AI_ERROR_FRIENDLY_MESSAGES` (`services/ai/errors.ts`), texto próprio (não reaproveitado: código de erro diferente, `LLMProviderErrorCode`, não `AIProviderErrorCode`). */
function friendlyMessageFor(error: unknown): string {
  if (error instanceof LLMProviderError) {
    switch (error.code) {
      case 'timeout':
        return 'A IA demorou demais para responder. Pode tentar de novo?';
      case 'rate_limit':
        return 'A IA está recebendo muitas mensagens agora. Espera um instante e tenta de novo.';
      case 'invalid_response':
        return 'A IA recebeu uma resposta que não conseguiu entender. Pode reformular?';
      case 'unavailable':
        return 'A IA está temporariamente indisponível. Tenta de novo em instantes.';
    }
  }
  return 'Não consegui processar sua mensagem agora. Tenta de novo em instantes.';
}
