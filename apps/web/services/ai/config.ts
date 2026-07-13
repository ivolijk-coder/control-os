import type { AIProvider } from './interfaces';
import { MockAIProvider } from './providers/MockAIProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import type { AIProviderName } from './types';

/**
 * Ponto único de configuração de qual "cérebro" a NOVA usa (CONTROL OS —
 * Preparação para OpenAI GPT-5.5).
 *
 * `NEXT_PUBLIC_AI_PROVIDER=openai` é o único gatilho para trocar de
 * provedor — sem alterar nenhuma outra parte do sistema, exatamente como
 * pedido. Usa o prefixo `NEXT_PUBLIC_` (não `AI_PROVIDER` puro) porque este
 * valor é lido também em componentes client (`NovaWorkspace`), e o Next.js
 * só inlina no bundle do navegador variáveis de ambiente com esse prefixo —
 * uma variável `AI_PROVIDER` sem prefixo existiria só no servidor e ficaria
 * sempre `undefined` no cliente.
 *
 * Hoje `AI_PROVIDER` só pode valer `'mock'` na prática: mesmo que alguém
 * defina `NEXT_PUBLIC_AI_PROVIDER=openai`, `OpenAIProvider` lança erro em
 * qualquer chamada (ainda não implementado) — isso é intencional, não um
 * bug. Nenhuma chamada HTTP, API key ou custo acontece nesta fase.
 */
export const AI_PROVIDER: AIProviderName =
  process.env.NEXT_PUBLIC_AI_PROVIDER === 'openai' ? 'openai' : 'mock';

let cachedProvider: AIProvider | undefined;

/**
 * Fábrica do provedor ativo. Cacheia a instância — provedores são
 * stateless (toda leitura de dados vem via `AIConversationContext`, passado
 * a cada chamada), então uma única instância por sessão do app é
 * suficiente e evita recriar a classe a cada turno de conversa.
 */
export function getAIProvider(): AIProvider {
  if (!cachedProvider) {
    cachedProvider = AI_PROVIDER === 'openai' ? new OpenAIProvider() : new MockAIProvider();
  }
  return cachedProvider;
}
