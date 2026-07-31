import type { FinanceTransactionStatus } from '@control-os/types';
import type { FinanceMutationResult } from './finance-api-client';

export type FinanceLifecycleAction = 'confirm' | 'cancel' | 'reverse';

export type FinanceLifecycleExecutionResult =
  | { kind: 'ignored' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export function lifecycleActionsForStatus(status: FinanceTransactionStatus): FinanceLifecycleAction[] {
  if (status === 'pendente') return ['confirm', 'cancel'];
  if (status === 'confirmada') return ['reverse'];
  return [];
}

export function lifecycleActionKey(action: FinanceLifecycleAction, transactionId: string): string {
  return `${action}:${transactionId}`;
}

export async function executeFinanceLifecycleAction(params: {
  action: FinanceLifecycleAction;
  transactionId: string;
  locks: Set<string>;
  execute: (transactionId: string) => Promise<FinanceMutationResult>;
  onPendingChange?: (key: string, pending: boolean) => void;
}): Promise<FinanceLifecycleExecutionResult> {
  const key = lifecycleActionKey(params.action, params.transactionId);
  if (params.locks.has(key)) return { kind: 'ignored' };

  params.locks.add(key);
  params.onPendingChange?.(key, true);
  try {
    const result = await params.execute(params.transactionId);
    return { kind: 'success', message: result.message };
  } catch (cause) {
    return {
      kind: 'error',
      message: cause instanceof Error ? cause.message : 'Não foi possível concluir a operação financeira.',
    };
  } finally {
    params.locks.delete(key);
    params.onPendingChange?.(key, false);
  }
}
