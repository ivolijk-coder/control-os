'use client';

import * as React from 'react';
import { Button } from '@control-os/ui';
import { AlertTriangle, CalendarCheck, CalendarClock, CalendarDays, Landmark, Layers3, Plus, Wallet, X } from 'lucide-react';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormError } from '@/components/ui/form-error';
import { Skeleton } from '@/components/ui/skeleton';
import { FloatingPanel } from '@/components/ui/floating-panel';
import { SectionHeader } from '@/components/dashboard/section-header';
import { DashboardCard } from '@/components/dashboard/dashboard-card';
import { cn, formatCurrency } from '@/lib/utils';
import {
  useCreateFinancialContract,
  useFinancialContract,
  useFinancialContracts,
  useFinancialContractsDashboard,
  usePayFinancialInstallment,
  useUndoFinancialInstallmentPayment,
  type CreateFinancialContractInput,
  type FinancialContractDto,
  type FinancialContractSource,
  type FinancialContractType,
  type FinancialInstallmentDto,
  type FinancialInstallmentWithContractDto,
} from '@/lib/finance-contracts';

/** Contexto mínimo pra abrir o modal "Confirmar pagamento" (ponto 5 do script) a partir de qualquer lugar da tela (lista, bloco de alerta ou timeline do detalhe). */
type PayTarget = {
  installmentId: string;
  contractName: string;
  number: number;
  totalInstallments: number;
  amount: number;
};

const SOURCE_LABEL: Record<FinancialContractSource, string> = {
  MANUAL: 'Manual',
  NOVA: 'NOVA',
  DOCUMENT: 'Documento',
};

/**
 * "Parcelas & Empréstimos" — evolução do módulo (script do usuário,
 * ago/2026). Substitui o antigo re-export da tela geral de Financeiro por
 * uma tela dedicada, no mesmo padrão visual do resto do CONTROL OS
 * (`DashboardCard`/`GlassCard`/`SectionHeader`, sem `<table>` — nenhuma
 * outra tela do produto usa tabela HTML, as "colunas" pedidas no script
 * viram linhas compactas dentro de `GlassCard`, mesmo tratamento que
 * `financeiro/page.tsx` já dá a lançamentos e `contas/page.tsx` dá a
 * contas).
 *
 * "Adicionar contrato" expande um formulário inline (mesmo padrão de
 * `financeiro/contas/page.tsx`); "Marcar pago" abre `PaymentConfirmModal`
 * (`FloatingPanel`/Radix Dialog — mesmo componente-base de todo overlay do
 * CONTROL OS) a partir de qualquer lugar da tela (lista, bloco de alerta ou
 * timeline do detalhe). Cards/lista/detalhe chegaram no commit anterior
 * ("add installments dashboard page"); este commit ("payment and reversal
 * flow") acrescenta o modal de pagamento, "Reverter pagamento" na timeline
 * e as rotas/hooks que os dois usam.
 */

const CONTRACT_TYPES: Array<{ value: FinancialContractType; label: string }> = [
  { value: 'LOAN', label: 'Empréstimo' },
  { value: 'FINANCING', label: 'Financiamento' },
  { value: 'CARD_INSTALLMENT', label: 'Cartão parcelado' },
  { value: 'SUPPLIER', label: 'Fornecedor' },
];

function contractTypeLabel(type: FinancialContractType): string {
  return CONTRACT_TYPES.find((item) => item.value === type)?.label ?? type;
}

function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(iso));
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextPendingInstallment(contract: FinancialContractDto): FinancialInstallmentDto | undefined {
  return contract.installments?.find((item) => item.status === 'PENDING' || item.status === 'OVERDUE');
}

function centsFromInput(value: string): number | undefined {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  if (!normalized) return undefined;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

export default function ParcelamentosPage() {
  const dashboardQuery = useFinancialContractsDashboard();
  const contractsQuery = useFinancialContracts();
  const createContract = useCreateFinancialContract();
  const payInstallment = usePayFinancialInstallment();
  const undoPayment = useUndoFinancialInstallmentPayment();

  const [formOpen, setFormOpen] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [payTarget, setPayTarget] = React.useState<PayTarget | null>(null);
  const [payDate, setPayDate] = React.useState(todayInputValue());
  const [selectedContractId, setSelectedContractId] = React.useState<string | undefined>(undefined);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const loading = dashboardQuery.isPending || contractsQuery.isPending;
  const errorMessage = dashboardQuery.isError
    ? dashboardQuery.error.message
    : contractsQuery.isError
      ? contractsQuery.error.message
      : null;

  async function handleCreateContract(input: CreateFinancialContractInput): Promise<void> {
    setFormError(null);
    try {
      await createContract.mutateAsync(input);
      setFormOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível criar o contrato agora.');
    }
  }

  function openPayModal(target: PayTarget): void {
    setActionError(null);
    setPayDate(todayInputValue());
    setPayTarget(target);
  }

  async function confirmPay(): Promise<void> {
    if (!payTarget) return;
    setActionError(null);
    try {
      await payInstallment.mutateAsync({ id: payTarget.installmentId, paidAt: payDate ? `${payDate}T12:00:00.000Z` : undefined });
      setPayTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível marcar a parcela como paga.');
    }
  }

  async function handleUndo(installmentId: string): Promise<void> {
    setActionError(null);
    try {
      await undoPayment.mutateAsync(installmentId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível desfazer o pagamento.');
    }
  }

  if (loading) return <ParcelamentosLoading />;

  if (errorMessage) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <SectionHeader level="page" title="Parcelas & Empréstimos" />
        <FormError message={errorMessage} />
      </div>
    );
  }

  const dashboard = dashboardQuery.data!;
  const contracts = contractsQuery.data!;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
      <FadeIn>
        <SectionHeader
          level="page"
          title="Parcelas & Empréstimos"
          description="Contratos de empréstimo, financiamento, cartão parcelado e fornecedores — com ciclo de vida completo de cada parcela."
          meta={`${contracts.length} contrato${contracts.length === 1 ? '' : 's'}`}
        />
      </FadeIn>

      <FadeIn delay={0.05}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <DashboardCard icon={Wallet} label="Saldo devedor total" value={formatCurrency(dashboard.outstandingBalance.total)} delta={`${dashboard.outstandingBalance.count} parcela${dashboard.outstandingBalance.count === 1 ? '' : 's'}`} accent="red" />
          <DashboardCard icon={CalendarDays} label="Vencendo este mês" value={formatCurrency(dashboard.dueThisMonth.total)} delta={`${dashboard.dueThisMonth.count} parcela${dashboard.dueThisMonth.count === 1 ? '' : 's'}`} accent="blue" />
          <DashboardCard icon={CalendarCheck} label="Pagas no mês" value={formatCurrency(dashboard.paidThisMonth.total)} delta={`${dashboard.paidThisMonth.count} parcela${dashboard.paidThisMonth.count === 1 ? '' : 's'}`} accent="green" />
          <DashboardCard icon={Layers3} label="Pendentes" value={formatCurrency(dashboard.pending.total)} delta={`${dashboard.pending.count} parcela${dashboard.pending.count === 1 ? '' : 's'}`} accent="purple" />
          <DashboardCard icon={AlertTriangle} label="Atrasadas" value={formatCurrency(dashboard.overdue.total)} delta={`${dashboard.overdue.count} parcela${dashboard.overdue.count === 1 ? '' : 's'}`} accent="red" highlight={dashboard.overdue.count > 0} />
        </div>
      </FadeIn>

      <FadeIn delay={0.08}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SmartBlock icon={CalendarClock} title="Vence hoje" items={dashboard.dueToday} emptyText="Nada vencendo hoje." />
          <SmartBlock icon={CalendarDays} title="Vence essa semana" items={dashboard.dueThisWeek} emptyText="Nada vencendo nos próximos 7 dias." />
          <SmartBlock icon={AlertTriangle} title="Atrasadas" items={dashboard.overdue.items} emptyText="Nenhuma parcela atrasada." accent="text-accent-red" />
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setFormOpen((value) => !value)}
              className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-hover"
            >
              <Plus className="h-4 w-4" /> Adicionar contrato
            </button>
          </div>
          {formOpen && (
            <NewContractForm
              saving={createContract.isPending}
              error={formError}
              onSubmit={handleCreateContract}
              onCancel={() => { setFormOpen(false); setFormError(null); }}
            />
          )}
        </div>
      </FadeIn>

      {actionError && (
        <FadeIn>
          <FormError message={actionError} />
        </FadeIn>
      )}

      <FadeIn delay={0.13}>
        <div className="flex flex-col gap-3">
          <SectionHeader title="Parcelas do mês" meta={`${dashboard.dueThisMonth.items.length}`} />
          {dashboard.dueThisMonth.items.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Nenhuma parcela vencendo este mês." description="Parcelas de contratos ativos aparecerão aqui." />
          ) : (
            <div className="flex flex-col gap-2">
              {dashboard.dueThisMonth.items.map((installment) => (
                <InstallmentRow
                  key={installment.id}
                  installment={installment}
                  onStartPay={() =>
                    openPayModal({
                      installmentId: installment.id,
                      contractName: installment.contractInstitution ? `${installment.contractInstitution} — ${installment.contractName}` : installment.contractName,
                      number: installment.number,
                      totalInstallments: contracts.find((item) => item.id === installment.contractId)?.totalInstallments ?? installment.number,
                      amount: installment.amount,
                    })
                  }
                />
              ))}
            </div>
          )}
        </div>
      </FadeIn>

      <FadeIn delay={0.18}>
        <div className="flex flex-col gap-3">
          <SectionHeader title="Contratos cadastrados" meta={`${contracts.length}`} />
          {contracts.length === 0 ? (
            <EmptyState icon={Landmark} title="Nenhum contrato cadastrado ainda." description="Cadastre um empréstimo, financiamento ou parcelamento — ou peça pra NOVA cadastrar a partir de um documento." />
          ) : (
            <div className="flex flex-col gap-2">
              {contracts.map((contract) => (
                <ContractRow
                  key={contract.id}
                  contract={contract}
                  onOpenDetail={() => setSelectedContractId(contract.id)}
                  onStartPay={() => {
                    const next = nextPendingInstallment(contract);
                    if (!next) return;
                    openPayModal({
                      installmentId: next.id,
                      contractName: contract.name,
                      number: next.number,
                      totalInstallments: contract.totalInstallments,
                      amount: next.amount,
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </FadeIn>

      <PaymentConfirmModal
        target={payTarget}
        payDate={payDate}
        onPayDateChange={setPayDate}
        submitting={payInstallment.isPending}
        onCancel={() => setPayTarget(null)}
        onConfirm={() => void confirmPay()}
      />

      <ContractDetailPanel
        contractId={selectedContractId}
        onClose={() => setSelectedContractId(undefined)}
        onStartPay={(target) => openPayModal(target)}
        onUndo={(installmentId) => void handleUndo(installmentId)}
        undoSubmitting={undoPayment.isPending}
      />
    </div>
  );
}

function SmartBlock({
  icon: Icon,
  title,
  items,
  emptyText,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: FinancialInstallmentWithContractDto[];
  emptyText: string;
  accent?: string;
}) {
  return (
    <GlassCard interactive={false} className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', accent ?? 'text-text-tertiary')} />
        <p className="text-xs font-semibold text-text-primary">{title}</p>
        <span className="ml-auto text-xs text-text-tertiary">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-text-tertiary">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.slice(0, 5).map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
              <span className="min-w-0 truncate text-text-secondary">
                {item.contractInstitution ? `${item.contractInstitution} ${item.contractName}` : item.contractName}
              </span>
              <span className="shrink-0 font-mono text-text-primary">{formatCurrency(item.amount)}</span>
            </div>
          ))}
          {items.length > 5 && <p className="text-xs text-text-tertiary">+{items.length - 5} outra{items.length - 5 === 1 ? '' : 's'}</p>}
        </div>
      )}
    </GlassCard>
  );
}

function StatusBadge({ status }: { status: FinancialInstallmentWithContractDto['status'] }) {
  const map: Record<typeof status, { label: string; className: string }> = {
    PENDING: { label: 'Pendente', className: 'bg-tint/[0.06] text-text-secondary' },
    OVERDUE: { label: 'Atrasada', className: 'bg-accent-red/10 text-accent-red' },
    PAID: { label: 'Paga', className: 'bg-accent-green/10 text-accent-green' },
    CANCELLED: { label: 'Cancelada', className: 'bg-tint/[0.06] text-text-tertiary' },
  };
  const { label, className } = map[status];
  return <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', className)}>{label}</span>;
}

function OriginBadge({ source }: { source: FinancialContractSource }) {
  const className =
    source === 'MANUAL'
      ? 'bg-tint/[0.06] text-text-tertiary'
      : source === 'NOVA'
        ? 'bg-accent-purple/10 text-accent-purple'
        : 'bg-accent-blue/10 text-accent-blue';
  return <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-medium', className)}>{SOURCE_LABEL[source]}</span>;
}

function InstallmentRow({ installment, onStartPay }: { installment: FinancialInstallmentWithContractDto; onStartPay: () => void }) {
  return (
    <GlassCard interactive={false} className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col">
          <p className="truncate text-sm text-text-primary">
            {installment.contractInstitution ? `${installment.contractInstitution} — ${installment.contractName}` : installment.contractName}
          </p>
          <p className="text-xs text-text-tertiary">Parcela {installment.number} · vence em {formatShortDate(installment.dueDate)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-sm text-text-primary">{formatCurrency(installment.amount)}</span>
          <StatusBadge status={installment.status} />
          {installment.status !== 'PAID' && installment.status !== 'CANCELLED' && (
            <button
              type="button"
              onClick={onStartPay}
              className="rounded-lg border border-accent-green/30 px-3 py-1.5 text-xs font-medium text-accent-green hover:bg-accent-green/10"
            >
              ✓ Marcar pago
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

function ContractRow({
  contract,
  onOpenDetail,
  onStartPay,
}: {
  contract: FinancialContractDto;
  onOpenDetail: () => void;
  onStartPay: () => void;
}) {
  const next = nextPendingInstallment(contract);

  return (
    <GlassCard interactive={false} className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onOpenDetail} className="flex min-w-0 flex-col text-left">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-text-primary hover:underline">{contract.name}</span>
            <OriginBadge source={contract.source} />
          </span>
          <span className="text-xs text-text-tertiary">
            {contractTypeLabel(contract.type)}
            {contract.institution ? ` · ${contract.institution}` : ''} · {contract.paidInstallments}/{contract.totalInstallments} pagas
            {next ? ` · Próxima: ${formatShortDate(next.dueDate)}` : ''}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="font-mono text-sm text-text-primary">{formatCurrency(contract.installmentAmount)}</span>
            <span className="text-[11px] text-text-tertiary">de {formatCurrency(contract.totalAmount)} contratados</span>
          </div>
          {next && (
            <button type="button" onClick={onStartPay} className="rounded-lg border border-accent-green/30 px-3 py-1.5 text-xs font-medium text-accent-green hover:bg-accent-green/10">
              ✓ Marcar pago
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

/**
 * Modal "Confirmar pagamento" (seção 5 do script): Contrato / Parcela /
 * Valor / Data + Confirmar. Usa `FloatingPanel` (Radix Dialog) — mesmo
 * componente-base de todo overlay do CONTROL OS (ex.: detalhe de
 * transação/confirmação de estorno em `financeiro/transacoes/page.tsx`),
 * não um expand inline.
 */
function PaymentConfirmModal({
  target,
  payDate,
  onPayDateChange,
  submitting,
  onCancel,
  onConfirm,
}: {
  target: PayTarget | null;
  payDate: string;
  onPayDateChange: (value: string) => void;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <FloatingPanel open={Boolean(target)} onOpenChange={(open) => { if (!open && !submitting) onCancel(); }} title="Confirmar pagamento" className="max-w-md">
      <div className="space-y-5 p-6">
        <h2 className="text-lg font-semibold text-text-primary">Confirmar pagamento</h2>
        {target && (
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-text-tertiary">Contrato</dt>
              <dd className="text-text-primary">{target.contractName}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-text-tertiary">Parcela</dt>
              <dd className="text-text-primary">{target.number}/{target.totalInstallments}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-text-tertiary">Valor</dt>
              <dd className="font-mono text-text-primary">{formatCurrency(target.amount)}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-text-tertiary">Data</dt>
              <dd>
                <input
                  type="date"
                  value={payDate}
                  onChange={(event) => onPayDateChange(event.target.value)}
                  className="rounded-lg border border-border-subtle bg-surface-0 px-2 py-1 text-sm text-text-primary outline-none focus:border-accent-blue"
                />
              </dd>
            </div>
          </dl>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={submitting} onClick={onCancel}>Cancelar</Button>
          <Button type="button" variant="primary" loading={submitting} disabled={!target || submitting} onClick={onConfirm}>
            {submitting ? 'Confirmando…' : 'Confirmar pagamento'}
          </Button>
        </div>
      </div>
    </FloatingPanel>
  );
}

/**
 * "Detalhe do contrato" (seção 4 do script): progresso de quitação, valor
 * pago, saldo restante, próxima parcela e timeline completa — exemplo
 * literal do script ("PRONAMPE SANTANDER / 42 parcelas / 18/42 pagas /
 * Pago: R$108.000 / Restante: R$144.000 / Próxima: 24/08/2026 — R$6.000").
 */
function ContractDetailPanel({
  contractId,
  onClose,
  onStartPay,
  onUndo,
  undoSubmitting,
}: {
  contractId: string | undefined;
  onClose: () => void;
  onStartPay: (target: PayTarget) => void;
  onUndo: (installmentId: string) => void;
  undoSubmitting: boolean;
}) {
  const contractQuery = useFinancialContract(contractId);
  const contract = contractQuery.data;
  const installments = contract?.installments ?? [];
  const paidTotal = installments.filter((item) => item.status === 'PAID').reduce((total, item) => total + item.amount, 0);
  const remainingTotal = installments.filter((item) => item.status !== 'PAID' && item.status !== 'CANCELLED').reduce((total, item) => total + item.amount, 0);
  const next = contract ? nextPendingInstallment(contract) : undefined;
  const progressPct = contract && contract.totalInstallments > 0 ? Math.round((contract.paidInstallments / contract.totalInstallments) * 100) : 0;

  return (
    <FloatingPanel
      open={Boolean(contractId)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Detalhe do contrato"
      description="Progresso de quitação, valores e timeline das parcelas."
      className="max-h-[calc(100vh-8rem)] max-w-2xl overflow-y-auto"
    >
      <div className="flex items-center justify-between border-b border-tint/[0.08] px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-text-primary">Detalhe do contrato</p>
          <p className="mt-0.5 text-xs text-text-tertiary">Ciclo de vida completo das parcelas</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar detalhes" className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-tint/[0.06] hover:text-text-primary">
          <X className="h-4 w-4" />
        </button>
      </div>

      {contractQuery.isPending ? (
        <div className="space-y-4 p-5" aria-label="Carregando detalhes do contrato">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24" />
          <Skeleton className="h-32" />
        </div>
      ) : contractQuery.isError ? (
        <div className="p-5">
          <FormError message={contractQuery.error.message || 'Não foi possível carregar o contrato.'} />
        </div>
      ) : contract ? (
        <div className="space-y-6 p-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold uppercase tracking-tight text-text-primary">
                {contract.institution ? `${contract.institution} ${contract.name}` : contract.name}
              </h2>
              <OriginBadge source={contract.source} />
            </div>
            <p className="mt-1 text-xs text-text-tertiary">
              {contractTypeLabel(contract.type)} · {contract.totalInstallments} parcelas · {formatCurrency(contract.totalAmount)} contratados
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-text-tertiary">
              <span>{contract.paidInstallments}/{contract.totalInstallments} pagas</span>
              <span>{progressPct}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-tint/[0.06]">
              <div className="h-full rounded-full bg-accent-green transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <GlassCard interactive={false} className="p-4">
              <p className="text-xs text-text-tertiary">Pago</p>
              <p className="mt-1 font-mono text-lg text-accent-green">{formatCurrency(paidTotal)}</p>
            </GlassCard>
            <GlassCard interactive={false} className="p-4">
              <p className="text-xs text-text-tertiary">Restante</p>
              <p className="mt-1 font-mono text-lg text-text-primary">{formatCurrency(remainingTotal)}</p>
            </GlassCard>
            <GlassCard interactive={false} className="p-4">
              <p className="text-xs text-text-tertiary">Próxima</p>
              {next ? (
                <>
                  <p className="mt-1 text-sm text-text-primary">{formatShortDate(next.dueDate)}</p>
                  <p className="font-mono text-sm text-text-secondary">{formatCurrency(next.amount)}</p>
                </>
              ) : (
                <p className="mt-1 text-sm text-text-tertiary">Quitado</p>
              )}
            </GlassCard>
          </div>

          <div className="flex flex-col gap-2">
            <SectionHeader title="Timeline das parcelas" meta={`${installments.length}`} />
            {installments.map((installment) => (
              <TimelineRow
                key={installment.id}
                installment={installment}
                onStartPay={() =>
                  onStartPay({
                    installmentId: installment.id,
                    contractName: contract.name,
                    number: installment.number,
                    totalInstallments: contract.totalInstallments,
                    amount: installment.amount,
                  })
                }
                onUndo={() => onUndo(installment.id)}
                undoSubmitting={undoSubmitting}
              />
            ))}
          </div>
        </div>
      ) : null}
    </FloatingPanel>
  );
}

function TimelineRow({
  installment,
  onStartPay,
  onUndo,
  undoSubmitting,
}: {
  installment: FinancialInstallmentDto;
  onStartPay: () => void;
  onUndo: () => void;
  undoSubmitting: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle px-3 py-2.5 text-sm">
      <div className="flex min-w-0 flex-col">
        <span className="text-text-primary">Parcela {installment.number}</span>
        <span className="text-xs text-text-tertiary">
          vence em {formatShortDate(installment.dueDate)}
          {installment.paidAt ? ` · paga em ${formatShortDate(installment.paidAt)}` : ''}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-text-primary">{formatCurrency(installment.amount)}</span>
        <StatusBadge status={installment.status} />
        {installment.status !== 'PAID' && installment.status !== 'CANCELLED' && (
          <button type="button" onClick={onStartPay} className="rounded-lg border border-accent-green/30 px-2.5 py-1 text-xs font-medium text-accent-green hover:bg-accent-green/10">
            ✓ Marcar pago
          </button>
        )}
        {installment.status === 'PAID' && (
          <button type="button" disabled={undoSubmitting} onClick={onUndo} className="rounded-lg px-2.5 py-1 text-xs text-text-secondary hover:bg-tint/[0.05] disabled:opacity-50">
            Reverter pagamento
          </button>
        )}
      </div>
    </div>
  );
}

function NewContractForm({
  saving,
  error,
  onSubmit,
  onCancel,
}: {
  saving: boolean;
  error: string | null;
  onSubmit: (input: CreateFinancialContractInput) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState('');
  const [institution, setInstitution] = React.useState('');
  const [type, setType] = React.useState<FinancialContractType>('LOAN');
  const [totalAmount, setTotalAmount] = React.useState('');
  const [installmentAmount, setInstallmentAmount] = React.useState('');
  const [totalInstallments, setTotalInstallments] = React.useState('');
  const [dueDay, setDueDay] = React.useState('');
  const [startDate, setStartDate] = React.useState(todayInputValue());
  const [localError, setLocalError] = React.useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setLocalError(null);
    const totalAmountValue = centsFromInput(totalAmount);
    if (!name.trim()) { setLocalError('Informe o nome do contrato.'); return; }
    if (totalAmountValue === undefined) { setLocalError('Informe o valor total do contrato.'); return; }
    const totalInstallmentsValue = Number(totalInstallments);
    if (!Number.isInteger(totalInstallmentsValue) || totalInstallmentsValue < 1) { setLocalError('Informe o número de parcelas.'); return; }
    const dueDayValue = Number(dueDay);
    if (!Number.isInteger(dueDayValue) || dueDayValue < 1 || dueDayValue > 31) { setLocalError('Informe o dia de vencimento (1 a 31).'); return; }
    const installmentAmountValue = installmentAmount ? centsFromInput(installmentAmount) : undefined;

    void onSubmit({
      name: name.trim(),
      institution: institution.trim() || undefined,
      type,
      totalAmount: totalAmountValue,
      installmentAmount: installmentAmountValue,
      totalInstallments: totalInstallmentsValue,
      dueDay: dueDayValue,
      startDate: startDate ? `${startDate}T12:00:00.000Z` : undefined,
      source: 'MANUAL',
    });
  }

  return (
    <GlassCard interactive={false} className="p-5">
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={submit}>
        <label className="block text-sm text-text-secondary sm:col-span-2">
          Nome do contrato
          <input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Pronampe Santander" className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary outline-none focus:border-accent-blue" />
        </label>
        <label className="block text-sm text-text-secondary">
          Instituição
          <input value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="Ex.: Santander" className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary outline-none focus:border-accent-blue" />
        </label>
        <label className="block text-sm text-text-secondary">
          Tipo
          <select value={type} onChange={(event) => setType(event.target.value as FinancialContractType)} className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary outline-none focus:border-accent-blue">
            {CONTRACT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="block text-sm text-text-secondary">
          Valor total
          <input inputMode="decimal" required value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} placeholder="252000,00" className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary outline-none focus:border-accent-blue" />
        </label>
        <label className="block text-sm text-text-secondary">
          Valor da parcela (opcional)
          <input inputMode="decimal" value={installmentAmount} onChange={(event) => setInstallmentAmount(event.target.value)} placeholder="6000,00" className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary outline-none focus:border-accent-blue" />
        </label>
        <label className="block text-sm text-text-secondary">
          Número de parcelas
          <input inputMode="numeric" required value={totalInstallments} onChange={(event) => setTotalInstallments(event.target.value)} placeholder="42" className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary outline-none focus:border-accent-blue" />
        </label>
        <label className="block text-sm text-text-secondary">
          Dia de vencimento
          <input inputMode="numeric" required value={dueDay} onChange={(event) => setDueDay(event.target.value)} placeholder="24" className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary outline-none focus:border-accent-blue" />
        </label>
        <label className="block text-sm text-text-secondary">
          Data da 1ª parcela
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary outline-none focus:border-accent-blue" />
        </label>
        {(localError ?? error) && (
          <div className="sm:col-span-2">
            <FormError message={localError ?? error} />
          </div>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <button disabled={saving} type="submit" className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink hover:bg-brand-hover disabled:opacity-50">
            {saving ? 'Criando…' : 'Criar contrato'}
          </button>
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-tint/[0.05]">Cancelar</button>
        </div>
      </form>
    </GlassCard>
  );
}

function ParcelamentosLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8" aria-label="Carregando Parcelas & Empréstimos">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-28" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((item) => <Skeleton key={item} className="h-32" />)}
      </div>
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}
