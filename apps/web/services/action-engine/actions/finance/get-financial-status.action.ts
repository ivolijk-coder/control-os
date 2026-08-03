import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { FinancialIntelligenceService } from '@/services/financial-intelligence';
import { financialIntelligenceService as defaultFinancialIntelligenceService } from '@/services/financial-intelligence/financial-intelligence.sources';
import { currentFinanceUserId } from '@/services/modules/finance/finance-user-context';
import type { ActionHandler } from '../../action.interfaces';

/** Consulta consolidada e somente leitura da situação financeira autenticada. */
export class FinancialStatusAction implements ActionHandler {
  readonly kind: ActionKind = 'financial_status.get';

  readonly capability: Capability = {
    kind: 'financial_status.get',
    description: 'Consulta a situação financeira consolidada do usuário autenticado.',
    parameters: [],
    examples: ['Tenho conta em atraso?', 'Estou devendo?', 'Quanto devo?', 'Estou no vermelho?'],
  };

  constructor(
    private readonly service: FinancialIntelligenceService = defaultFinancialIntelligenceService
  ) {}

  async execute(_payload: Record<string, unknown>): Promise<ActionResult> {
    const userId = currentFinanceUserId();
    if (!userId) {
      return { success: false, message: 'Faça login para consultar sua situação financeira.' };
    }

    try {
      const status = await this.service.getStatus(userId);
      return {
        success: true,
        message: 'Situação financeira consultada com sucesso.',
        data: status,
      };
    } catch {
      return {
        success: false,
        message: 'Não foi possível consultar sua situação financeira agora.',
      };
    }
  }
}
