import type { GoalsService } from '@/services/modules';
import { goalsService as defaultGoalsService } from '@/services/modules';
import type { ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import type { ActionHandler } from '../../action.interfaces';
import { getString } from '../../payload-guards';

/**
 * `task.create` — cria uma `Mission` com `kind: 'lembrete'`
 * (`GoalsService.createMission`, ver `services/modules/goals/goals.types.ts`
 * para o porquê de tarefa e meta compartilharem um Service só).
 */
export class CreateTaskAction implements ActionHandler {
  readonly kind: ActionKind = 'task.create';

  /**
   * Deliberadamente NÃO listado na Capability Registry padrão do pedido
   * original da Fase 5 (os 10 exemplos dados omitem `task.create`) — mas a
   * Action continua existindo e registrada (Fase 4), então descrevê-la aqui
   * é "reutilizar o que já existe" em vez de tratá-la como caso especial; o
   * Decision Engine LLM pode escolhê-la como qualquer outra.
   */
  readonly capability: Capability = {
    kind: 'task.create',
    description: 'Cria um lembrete/tarefa simples para o usuário.',
    parameters: [
      { name: 'title', type: 'string', required: true, description: 'O que o usuário quer ser lembrado de fazer.' },
      { name: 'dueDate', type: 'string', required: false, description: 'Data do lembrete (AAAA-MM-DD), se mencionada.' },
    ],
    examples: [
      'Me lembra de ligar pro dentista amanhã -> {"kind":"task.create","confidence":0.9,"parameters":{"title":"Ligar pro dentista","dueDate":"2026-07-21"}}',
    ],
  };

  constructor(private readonly goalsService: GoalsService = defaultGoalsService) {}

  async execute(payload: Record<string, unknown>): Promise<ActionResult> {
    const title = getString(payload, 'title');
    if (!title) {
      return { success: false, message: 'Não entendi o título da tarefa — preciso de um "title" para criar.' };
    }
    return this.goalsService.createMission({
      title,
      kind: 'lembrete',
      dueDate: getString(payload, 'dueDate'),
    });
  }
}
