import * as React from 'react';
import type { FinanceTransactionDto, FinanceTransactionStatus } from '@control-os/types';
import { StatusBadge } from '@/components/dashboard/status-badge';
import { formatCurrency } from '@/lib/utils';

const STATUS_LABEL: Record<FinanceTransactionStatus, string> = {
  pendente: 'Pendente',
  confirmada: 'Confirmada',
  cancelada: 'Cancelada',
  estornada: 'Estornada',
};

const STATUS_TONE: Record<FinanceTransactionStatus, 'neutral' | 'green' | 'blue' | 'purple' | 'red'> = {
  pendente: 'neutral',
  confirmada: 'green',
  cancelada: 'red',
  estornada: 'purple',
};

export function FinanceTransactionStatusBadge({ status }: { status: FinanceTransactionStatus }) {
  return <StatusBadge label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />;
}

export function TransactionDetailContent({
  transaction,
  accountName,
}: {
  transaction: FinanceTransactionDto;
  accountName: string;
}) {
  const history = [
    ['Competência', transaction.competenceDate ?? transaction.date],
    ['Pagamento', transaction.paidAt],
    ['Confirmação', transaction.confirmedAt],
    ['Cancelamento', transaction.canceledAt],
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <div className="space-y-5 p-5">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-text-primary">{transaction.description}</h2>
          <FinanceTransactionStatusBadge status={transaction.status} />
        </div>
        <p className="mt-2 font-mono text-xl text-text-primary">{formatCurrency(transaction.amount)}</p>
      </div>

      <dl className="grid gap-3 rounded-xl border border-border-subtle bg-white/[0.025] p-4 sm:grid-cols-2">
        <DetailItem label="Categoria" value={transaction.category} />
        <DetailItem label="Conta" value={accountName} />
        <DetailItem label="Tipo" value={transaction.type} />
        <DetailItem label="Origem" value={transaction.source} />
        <DetailItem label="Competência" value={formatDate(transaction.competenceDate ?? transaction.date)} />
        <DetailItem
          label="Confirmação"
          value={transaction.confirmedAt ? formatDateTime(transaction.confirmedAt) : 'Ainda não confirmada'}
        />
      </dl>

      <section>
        <h3 className="text-sm font-medium text-text-primary">Histórico disponível</h3>
        <div className="mt-3 space-y-2">
          {history.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 text-xs">
              <span className="text-text-tertiary">{label}</span>
              <span className="text-text-secondary">{formatDateTime(value)}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium text-text-primary">Anexos</h3>
        <p className="mt-2 text-xs text-text-tertiary">Nenhum anexo disponível no contrato de consulta atual.</p>
      </section>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className="mt-1 text-sm capitalize text-text-primary">{value}</dd>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
