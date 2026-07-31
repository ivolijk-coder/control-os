import { describe, expect, it, vi } from 'vitest';
import {
  executeFinanceLifecycleAction,
  lifecycleActionKey,
  lifecycleActionsForStatus,
  type FinanceLifecycleAction,
} from '@/lib/finance/transaction-lifecycle-model';

describe('ciclo de vida das transações', () => {
  it('deriva as ações visuais exclusivamente do status recebido', () => {
    expect(lifecycleActionsForStatus('pendente')).toEqual(['confirm', 'cancel']);
    expect(lifecycleActionsForStatus('confirmada')).toEqual(['reverse']);
    expect(lifecycleActionsForStatus('cancelada')).toEqual([]);
    expect(lifecycleActionsForStatus('estornada')).toEqual([]);
  });

  it.each<FinanceLifecycleAction>(['confirm', 'cancel', 'reverse'])(
    'executa %s e preserva a mensagem de sucesso do backend',
    async (action) => {
      const execute = vi.fn().mockResolvedValue({
        transaction: { id: 'tx-1' },
        message: `Mensagem real: ${action}`,
      });
      const pending = vi.fn();

      const result = await executeFinanceLifecycleAction({
        action,
        transactionId: 'tx-1',
        locks: new Set(),
        execute,
        onPendingChange: pending,
      });

      expect(execute).toHaveBeenCalledOnce();
      expect(execute).toHaveBeenCalledWith('tx-1');
      expect(result).toEqual({ kind: 'success', message: `Mensagem real: ${action}` });
      expect(pending).toHaveBeenNthCalledWith(1, lifecycleActionKey(action, 'tx-1'), true);
      expect(pending).toHaveBeenNthCalledWith(2, lifecycleActionKey(action, 'tx-1'), false);
    }
  );

  it('exibe exatamente a mensagem de erro devolvida pelo backend', async () => {
    const result = await executeFinanceLifecycleAction({
      action: 'cancel',
      transactionId: 'tx-2',
      locks: new Set(),
      execute: vi.fn().mockRejectedValue(new Error('A transação já foi confirmada.')),
    });

    expect(result).toEqual({ kind: 'error', message: 'A transação já foi confirmada.' });
  });

  it('ignora uma segunda submissão enquanto a mesma ação está em andamento', async () => {
    let finish: ((value: { transaction: { id: string }; message: string }) => void) | undefined;
    const execute = vi.fn().mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const locks = new Set<string>();
    const input = {
      action: 'confirm' as const,
      transactionId: 'tx-3',
      locks,
      execute,
    };

    const first = executeFinanceLifecycleAction(input);
    const second = await executeFinanceLifecycleAction(input);

    expect(second).toEqual({ kind: 'ignored' });
    expect(execute).toHaveBeenCalledOnce();

    finish?.({ transaction: { id: 'tx-3' }, message: 'Confirmada.' });
    await expect(first).resolves.toEqual({ kind: 'success', message: 'Confirmada.' });
    expect(locks.size).toBe(0);
  });
});
