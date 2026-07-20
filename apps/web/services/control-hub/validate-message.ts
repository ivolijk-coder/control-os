import type { HubMessage, HubValidationResult } from './control-hub.types';

/**
 * Etapa "Validate" do pipeline do CONTROL HUB — única responsabilidade:
 * decidir se uma `HubMessage` está bem formada o suficiente para seguir
 * pipeline adiante. Não normaliza (ver `normalize-message.ts`), não
 * carrega contexto, não decide nada — só valida.
 *
 * Regras propositalmente simples nesta fase (só forma, nunca conteúdo):
 * identidade presente, tipo compatível com o que a mensagem carrega, data
 * de recebimento válida. Nenhuma regra de negócio (ex.: "usuário existe?",
 * "canal está autorizado?") mora aqui ainda — isso depende de persistência
 * real, fora do escopo desta fase.
 */
export function validateHubMessage(message: HubMessage): HubValidationResult {
  const errors: string[] = [];

  if (!message.id.trim()) {
    errors.push('id ausente ou vazio.');
  }
  if (!message.userId.trim()) {
    errors.push('userId ausente ou vazio.');
  }
  if (Number.isNaN(message.receivedAt.getTime())) {
    errors.push('receivedAt não é uma data válida.');
  }

  const hasText = message.content.trim().length > 0;
  const hasAttachments = (message.attachments?.length ?? 0) > 0;
  if (message.type !== 'event' && !hasText && !hasAttachments) {
    errors.push('mensagem sem conteúdo e sem anexos.');
  }

  return { valid: errors.length === 0, errors };
}
