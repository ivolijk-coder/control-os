import type { NovaIntent } from '@/services/nova';
import type { AIProvider } from '../interfaces';
import type { AIConversationContext, AIExtractedEntities, ChatMessage } from '../types';

const NOT_IMPLEMENTED_MESSAGE =
  'OpenAIProvider ainda não implementado. Defina AI_PROVIDER=mock (padrão) — ' +
  'este provider só deve ser instanciado depois que a integração real com o ' +
  'SDK da OpenAI (GPT-5.5) for construída.';

/**
 * Esqueleto do provedor real (CONTROL OS — Preparação para OpenAI GPT-5.5).
 *
 * NÃO integrar a API ainda. NÃO usar API Key. NÃO fazer chamadas HTTP. NÃO
 * gerar custo. Esta classe existe só para provar que a arquitetura já
 * comporta a troca — implementa `AIProvider`, então qualquer código que hoje
 * usa `MockAIProvider` continua funcionando sem alteração no dia em que
 * `getAIProvider()` (`services/ai/config.ts`) passar a devolver esta classe.
 *
 * Implementação futura, quando for a hora de ligar de verdade:
 *   1. `npm install openai` (SDK oficial da OpenAI).
 *   2. Instanciar o client no construtor, autenticado via
 *      `process.env.OPENAI_API_KEY` (nunca hardcoded, nunca no cliente —
 *      isso vai exigir mover a chamada para uma rota de servidor/edge
 *      function, já que `OPENAI_API_KEY` sem prefixo `NEXT_PUBLIC_` não
 *      pode vazar pro bundle do navegador).
 *   3. Cada método abaixo passa a montar o prompt certo (ver
 *      `services/ai/prompts/`) e chamar `client.chat.completions.create`
 *      (ou o endpoint equivalente) com o modelo GPT-5.5.
 *   4. `classifyIntent` deve devolver exatamente o formato `NovaIntent` —
 *      a resposta do modelo precisa ser parseada/validada para esse
 *      formato (sem `any`/`unknown` como atalho — validar campo a campo,
 *      como já é feito em `services/nova/memory/index.ts` para dados vindos
 *      de fora do sistema de tipos).
 *   5. `AI_PROVIDER=openai` no ambiente liga esta classe — sem alterar
 *      nenhuma outra parte do sistema.
 */
export class OpenAIProvider implements AIProvider {
  async chat(messages: ChatMessage[], context: AIConversationContext): Promise<string> {
    void messages;
    void context;
    // implementação futura: client.chat.completions.create({ model: 'gpt-5.5', messages, ... })
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async generateResponse(prompt: string, context: AIConversationContext): Promise<string> {
    void prompt;
    void context;
    // implementação futura: monta o SystemPrompt + prompt do usuário e chama o SDK.
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async classifyIntent(text: string, context: AIConversationContext): Promise<NovaIntent> {
    void text;
    void context;
    // implementação futura: usa PlannerPrompt + function calling / structured
    // output do modelo pra devolver um `NovaIntent` validado.
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async extractEntities(text: string): Promise<AIExtractedEntities> {
    void text;
    // implementação futura: extração de entidades via structured output do modelo.
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async summarize(text: string): Promise<string> {
    void text;
    // implementação futura: chamada de resumo via GPT-5.5.
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }

  async generateSuggestions(context: AIConversationContext): Promise<string[]> {
    void context;
    // implementação futura: sugestões contextuais geradas pelo modelo.
    throw new Error(NOT_IMPLEMENTED_MESSAGE);
  }
}
