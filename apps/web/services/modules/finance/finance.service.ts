import type { FinanceEntry } from '@control-os/types';
import type { ActionResult } from '@/services/action-result.types';
import type { FinanceService } from './finance.interfaces';
import type { CreateExpenseInput, DeleteExpenseInput, UpdateExpenseInput } from './finance.types';

const DEFAULT_CATEGORY = 'Outros';
let nextId = 1;

/**
 * "Nesta etapa utilizar mocks. Não conectar banco." Guarda um array de
 * `FinanceEntry` (`@control-os/types` — mesmo tipo que a UI/`useDataStore`
 * já usam, nenhuma forma nova) na MEMÓRIA do processo — diferente dos
 * providers do Context Provider (Fase 2, só leitura, um valor fixo), este
 * Service PRECISA de estado mutável: uma Action de `expense.create` real
 * tem que aparecer num `expense.update`/`expense.delete` seguinte na mesma
 * execução do processo. Reinicia zerado a cada reinício do servidor —
 * "sem persistência" é o comportamento esperado nesta fase, não um bug.
 *
 * Deliberadamente NÃO importa `apps/web/lib/data-store.ts` (o
 * `useDataStore` do Zustand): esse store só existe no navegador, dentro de
 * uma árvore React montada — é exatamente a dependência que o Action Engine
 * existe para NÃO ter, pra funcionar em qualquer canal (Web, WhatsApp, API,
 * Voz) sem precisar de uma aba de navegador aberta.
 */
export class MockFinanceService implements FinanceService {
  private readonly entries: FinanceEntry[] = [
    {
      id: 'finance_seed_1',
      type: 'despesa',
      description: 'Assinatura de software',
      amount: 89.9,
      category: 'Ferramentas',
      date: new Date().toISOString(),
    },
  ];

  async createExpense(input: CreateExpenseInput): Promise<ActionResult> {
    const entry: FinanceEntry = {
      id: `finance_${nextId++}`,
      type: 'despesa',
      description: input.description ?? 'Despesa registrada pela NOVA',
      amount: input.amount,
      category: input.category ?? DEFAULT_CATEGORY,
      date: input.date ?? new Date().toISOString(),
    };
    this.entries.push(entry);
    return { success: true, message: `Despesa de R$ ${entry.amount.toFixed(2)} registrada em "${entry.category}".`, data: entry };
  }

  async updateExpense(input: UpdateExpenseInput): Promise<ActionResult> {
    const entry = this.entries.find((candidate) => candidate.id === input.id);
    if (!entry) {
      return { success: false, message: `Nenhuma despesa encontrada com o id "${input.id}".` };
    }
    if (input.amount !== undefined) entry.amount = input.amount;
    if (input.description !== undefined) entry.description = input.description;
    if (input.category !== undefined) entry.category = input.category;
    if (input.date !== undefined) entry.date = input.date;
    return { success: true, message: `Despesa "${entry.description}" atualizada.`, data: entry };
  }

  async deleteExpense(input: DeleteExpenseInput): Promise<ActionResult> {
    const index = this.entries.findIndex((candidate) => candidate.id === input.id);
    if (index === -1) {
      return { success: false, message: `Nenhuma despesa encontrada com o id "${input.id}".` };
    }
    const [removed] = this.entries.splice(index, 1);
    return { success: true, message: `Despesa "${removed?.description ?? input.id}" removida.`, data: removed };
  }
}

export const financeService: FinanceService = new MockFinanceService();
