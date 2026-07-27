import type { FinanceService } from '@/services/modules';
import { financeService as defaultFinanceService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

function toCategoryKind(value: string | undefined): 'receita' | 'despesa' {
  return value === 'receita' ? 'receita' : 'despesa';
}

/**
 * `category.create` — CONTROL OS Fase 7 (Financeiro completo). "Permitir
 * categorias personalizadas" — soma ao catálogo padrão já embutido
 * (`DEFAULT_FINANCE_CATEGORIES`, `services/modules/finance/finance.service.ts`),
 * nunca o substitui.
 */
export class CreateCategoryAction implements ActionHandler {
  readonly kind: ActionKind = 'category.create';

  readonly capability: Capability = {
    kind: 'category.create',
    description: 'Cria uma categoria financeira personalizada do usuário, além das categorias padrão do sistema.',
    parameters: [
      { name: 'name', type: 'string', required: true, description: 'Nome da categoria (ex.: "Pet", "Assinaturas").' },
      { name: 'kind', type: 'string', required: false, description: '"despesa" ou "receita". Se ausente, a categoria é criada como despesa.' },
    ],
    examples: ['Cria uma categoria chamada Pet -> {"kind":"category.create","confidence":0.8,"parameters":{"name":"Pet"}}'],
  };

  constructor(private readonly financeService: FinanceService = defaultFinanceService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const name = getString(payload, 'name');
    if (!name) {
      return { success: false, message: 'Preciso de um "name" para criar a categoria.' };
    }
    return this.financeService.createCategory({ name, kind: toCategoryKind(getString(payload, 'kind')) });
  }
}
