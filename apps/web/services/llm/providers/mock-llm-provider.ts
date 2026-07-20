import type { LLMProvider } from '../llm.interfaces';
import type { LLMRequest, LLMResponse } from '../llm.types';

/**
 * `LLMProvider` determinístico, sem rede — existe para dois usos:
 * (1) testes de `OpenAIDecisionProvider`/`parseLLMDecisionResponse` sem
 * depender de credenciais nem de chamada real à OpenAI (injeta uma resposta
 * fixa por chamada); (2) uma alternativa caso um dia se queira rodar o
 * `OpenAIDecisionProvider` (Prompt Builder + validação completos) sem custo,
 * só trocando o `LLMProvider` injetado — a arquitetura toda menos "qual
 * texto o modelo devolve" continua sendo exercitada de verdade.
 *
 * Não confundir com `MockDecisionProvider`
 * (`services/decision-engine/mock-decision-provider.ts`) — este aqui é o
 * nível "conversar com um modelo" (`LLMProvider`); aquele é o nível
 * "decidir o que fazer" (`DecisionEngine`), e nem usa `LLMProvider` (é
 * 100% regex determinística, `parseIntent`).
 */
const DEFAULT_RESPONSE = '{"actions":[]}';

export class MockLLMProvider implements LLMProvider {
  private readonly queue: string[];
  private cursor = 0;

  /** `responses` — uma fila de conteúdos a devolver, um por chamada a `complete`; a última se repete depois de esgotada. Default: sempre "nenhuma ação". */
  constructor(responses: string[] = [DEFAULT_RESPONSE]) {
    this.queue = responses.length > 0 ? responses : [DEFAULT_RESPONSE];
  }

  async complete(_request: LLMRequest): Promise<LLMResponse> {
    const index = Math.min(this.cursor, this.queue.length - 1);
    const content = this.queue[index] ?? DEFAULT_RESPONSE;
    this.cursor += 1;
    return { content };
  }
}
