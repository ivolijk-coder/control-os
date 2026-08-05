import { describe, expect, it } from 'vitest';
import { DEFAULT_ACTION_HANDLERS } from '@/services/action-engine';
import { ActionExecutor } from '@/services/ai/conversation/ActionExecutor';

describe('limite de capacidades reais da NOVA', () => {
  it('não anuncia handlers apoiados apenas por services mockados', () => {
    const kinds = DEFAULT_ACTION_HANDLERS.map((handler) => handler.kind);
    expect(kinds).not.toContain('calendar.create');
    expect(kinds).not.toContain('calendar.update');
    expect(kinds).not.toContain('calendar.delete');
    expect(kinds).not.toContain('task.create');
    expect(kinds).not.toContain('goal.update');
    expect(kinds).not.toContain('habit.update');
    expect(kinds).not.toContain('note.create');
  });

  it('falha explicitamente sem executar uma action local legada', async () => {
    const action = { execute: async () => { throw new Error('não deveria executar'); } };
    const result = await new ActionExecutor().execute({} as never, { kind: 'criar_agenda', raw: 'marque reunião', title: 'Reunião' }, action as never);
    expect(result).toEqual([expect.objectContaining({ ok: false, detail: expect.stringContaining('não possui uma fonte persistente real') })]);
  });
});
