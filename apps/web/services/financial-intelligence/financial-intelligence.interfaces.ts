import type { FinancialStatusDTO } from './financial-intelligence.types';

/** Parâmetros de leitura; a implementação futura sempre resolverá `userId` fora da IA. */
export interface FinancialStatusQuery {
  /** Data de referência em ISO 8601. Ausente significa o instante atual do servidor. */
  referenceDate?: string;
  projectionHorizonDays?: number;
}

/**
 * Porta de leitura que a NOVA poderá consumir no futuro. A implementação não
 * faz parte deste PR e deverá compor serviços financeiros existentes.
 */
export interface FinancialIntelligenceService {
  getStatus(userId: string, query?: FinancialStatusQuery): Promise<FinancialStatusDTO>;
}
