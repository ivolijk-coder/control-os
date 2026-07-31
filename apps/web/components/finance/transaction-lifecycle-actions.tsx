import * as React from 'react';
import { Ban, Check, RotateCcw } from 'lucide-react';
import type { FinanceTransactionStatus } from '@control-os/types';
import { Button } from '@control-os/ui';
import {
  lifecycleActionKey,
  lifecycleActionsForStatus,
  type FinanceLifecycleAction,
} from '@/lib/finance/transaction-lifecycle-model';

const ACTION_CONTENT: Record<FinanceLifecycleAction, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  confirm: { label: 'Confirmar', icon: Check },
  cancel: { label: 'Cancelar', icon: Ban },
  reverse: { label: 'Estornar', icon: RotateCcw },
};

export function TransactionLifecycleActions({
  transactionId,
  status,
  pendingKeys,
  compact = false,
  onAction,
}: {
  transactionId: string;
  status: FinanceTransactionStatus;
  pendingKeys: ReadonlySet<string>;
  compact?: boolean;
  onAction: (action: FinanceLifecycleAction, transactionId: string) => void;
}) {
  const actions = lifecycleActionsForStatus(status);
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Ações da transação">
      {actions.map((action) => {
        const { label, icon: Icon } = ACTION_CONTENT[action];
        const pending = pendingKeys.has(lifecycleActionKey(action, transactionId));
        return (
          <Button
            key={action}
            type="button"
            size="sm"
            variant={action === 'confirm' ? 'primary' : action === 'reverse' ? 'danger' : 'secondary'}
            loading={pending}
            disabled={pending}
            onClick={() => onAction(action, transactionId)}
            aria-label={`${label} transação`}
          >
            {!pending && <Icon className="h-3.5 w-3.5" />}
            {!compact && (pending ? `${label}…` : label)}
          </Button>
        );
      })}
    </div>
  );
}

export function lifecycleActionLabel(action: FinanceLifecycleAction): string {
  return ACTION_CONTENT[action].label;
}
