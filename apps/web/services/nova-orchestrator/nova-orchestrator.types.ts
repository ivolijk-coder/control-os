import type { ActionRequest } from '@/services/control-hub';
import type {
  NovaConversationChannel,
  NovaConversationPersona,
} from '@/services/nova-conversations';

export const NOVA_TURN_STATUSES = [
  'RECEIVED',
  'PROCESSING',
  'AWAITING_CONFIRMATION',
  'EXECUTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;

export type NovaTurnStatus = (typeof NOVA_TURN_STATUSES)[number];

export const TERMINAL_NOVA_TURN_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'] as const;
export type TerminalNovaTurnStatus = (typeof TERMINAL_NOVA_TURN_STATUSES)[number];

/** Identidade confiável do turno. userId, canal e persona são definidos pelo servidor. */
export interface NovaTurnIdentity {
  readonly turnId: string;
  readonly conversationId: string;
  readonly clientTurnId: string;
  readonly userId: string;
  readonly channel: NovaConversationChannel;
  readonly persona: NovaConversationPersona;
}

/** Metadados operacionais que nunca fazem parte do payload escolhido pelo modelo. */
export interface NovaTurnOperationMetadata {
  readonly correlationId: string;
  readonly operationId: string;
  readonly receivedAt: Date;
}

export interface NovaProcessingLease {
  readonly ownerId: string;
  readonly claimedAt: Date;
  readonly expiresAt: Date;
  readonly attempt: number;
}

export interface NovaTurnSnapshot {
  readonly identity: NovaTurnIdentity;
  readonly operation: NovaTurnOperationMetadata;
  readonly status: NovaTurnStatus;
  readonly version: number;
  readonly lease: NovaProcessingLease | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NovaReferenceSelection =
  | { readonly kind: 'ENTITY'; readonly entityId: string; readonly entityType: string }
  | { readonly kind: 'SET'; readonly setReference: string; readonly entityType: string }
  | { readonly kind: 'RELATIVE'; readonly relation: 'OTHER' | 'PREVIOUS' | 'NEXT' | 'ORDINAL'; readonly ordinal?: number };

/**
 * Estado semântico aponta para o assunto ativo, nunca armazena saldos,
 * parcelas ou outros valores mutáveis como fonte de verdade.
 */
export interface NovaConversationSemanticState {
  readonly conversationId: string;
  readonly userId: string;
  readonly intentFamily: string;
  readonly focusCategory: string | null;
  readonly focusType: string | null;
  readonly focusReference: NovaReferenceSelection | null;
  readonly sourceTurnId: string;
  readonly version: number;
  readonly expiresAt: Date;
  readonly updatedAt: Date;
}

export interface ReferenceResolutionRequest {
  readonly identity: NovaTurnIdentity;
  readonly message: string;
  readonly semanticState: NovaConversationSemanticState | null;
  readonly recentMessages: readonly ReferenceMessage[];
}

export interface ReferenceMessage {
  readonly role: 'USER' | 'ASSISTANT';
  readonly content: string;
  readonly intent: string | null;
}

export type ReferenceResolution =
  | { readonly kind: 'RESOLVED'; readonly reference: NovaReferenceSelection; readonly sourceTurnId: string }
  | { readonly kind: 'AMBIGUOUS'; readonly candidates: readonly NovaReferenceSelection[] }
  | { readonly kind: 'NOT_FOUND' };

export type NovaPendingConfirmationStatus = 'PENDING' | 'CLAIMED' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED' | 'FAILED';

/** Plano interno validado. Nunca é serializado no DTO público. */
export interface NovaPendingConfirmation {
  readonly confirmationId: string;
  readonly turnId: string;
  readonly conversationId: string;
  readonly userId: string;
  readonly version: number;
  readonly status: NovaPendingConfirmationStatus;
  readonly preview: string;
  readonly validatedActions: readonly ActionRequest[];
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface NovaPublicMessageDTO {
  readonly id: string;
  readonly role: 'USER' | 'ASSISTANT';
  readonly content: string;
  readonly intent: string | null;
  readonly redacted: boolean;
  readonly createdAt: string;
}

export interface NovaConfirmationPreviewDTO {
  readonly confirmationId: string;
  readonly version: number;
  readonly preview: string;
  readonly expiresAt: string;
}

export type NovaOrchestratorResultDTO =
  | {
      readonly status: 'COMPLETED';
      readonly turnId: string;
      readonly messages: readonly NovaPublicMessageDTO[];
    }
  | {
      readonly status: 'AWAITING_CONFIRMATION';
      readonly turnId: string;
      readonly messages: readonly NovaPublicMessageDTO[];
      readonly confirmation: NovaConfirmationPreviewDTO;
    }
  | {
      readonly status: 'PROCESSING';
      readonly turnId: string;
    }
  | {
      readonly status: 'FAILED';
      readonly turnId: string;
      readonly error: { readonly code: string; readonly message: string };
    };

export interface NovaOrchestratorFeatureConfig {
  readonly serverOrchestratorEnabled: boolean;
}
