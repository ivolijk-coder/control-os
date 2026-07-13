import { ConversationService } from './ConversationService';

export { ConversationService } from './ConversationService';
export { IntentResolver } from './IntentResolver';
export { ActionExecutor } from './ActionExecutor';

/**
 * Instância única e compartilhada do `ConversationService` (CONTROL OS —
 * Etapa 8). Antes da Etapa 8, só existia um consumidor de UI
 * (`NovaWorkspace`, na conversa por texto) e ele criava sua própria
 * instância local — inofensivo enquanto havia só um consumidor. A partir da
 * Etapa 8, o Modo Conversa por voz é um SEGUNDO consumidor de UI, e
 * `ConversationService.pendingBySession` (o estado de confirmação de ações
 * sensíveis) é estado de instância, indexado por `sessionId` — duas
 * instâncias separadas não compartilhariam essa confirmação pendente entre
 * texto e voz. Este singleton garante que todo consumidor (texto, voz, e
 * qualquer canal futuro) fale com o mesmo `ConversationService`, exatamente
 * como o resto da NOVA CORE já funciona com uma única fonte de verdade.
 */
export const conversationService = new ConversationService();
