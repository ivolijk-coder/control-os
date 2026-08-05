import type { SanitizedConversationContent } from './nova-conversation.types';

export const REDACTED_CONTENT = '[CONTEÚDO SENSÍVEL REMOVIDO]';
export const MAX_CONVERSATION_MESSAGE_LENGTH = 20_000;

const PRIVATE_KEY_PATTERN = /-----BEGIN(?: [A-Z0-9]+)? PRIVATE KEY-----[\s\S]*?-----END(?: [A-Z0-9]+)? PRIVATE KEY-----/giu;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/giu;
const KNOWN_TOKEN_PATTERN = /\b(?:sk|rk|pk)[-_][A-Za-z0-9_-]{16,}\b/giu;
const LABELED_SECRET_PATTERN = /\b(senha|password|token|api[ _-]?key|access[ _-]?key|secret|segredo|chave privada|c[oó]digo de autentica[cç][aã]o|auth[ _-]?code)\s*[:=]\s*(?:"[^"]*"|'[^']*'|\S+)/giu;

function redactLabeledSecret(match: string): string {
  const separator = match.search(/[:=]/u);
  const label = separator >= 0 ? match.slice(0, separator).trim() : '';
  return label ? `${label}: ${REDACTED_CONTENT}` : REDACTED_CONTENT;
}
export function sanitizeConversationContent(raw: string): SanitizedConversationContent {
  let content = raw.slice(0, MAX_CONVERSATION_MESSAGE_LENGTH);
  content = content.replace(PRIVATE_KEY_PATTERN, REDACTED_CONTENT);
  content = content.replace(BEARER_PATTERN, REDACTED_CONTENT);
  content = content.replace(KNOWN_TOKEN_PATTERN, REDACTED_CONTENT);
  content = content.replace(LABELED_SECRET_PATTERN, redactLabeledSecret);
  return { content, redacted: content !== raw };
}
