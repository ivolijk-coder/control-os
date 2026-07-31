'use client';

import * as React from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  FileSearch,
  Search,
  X,
} from 'lucide-react';
import type {
  FinanceTransactionDto,
  FinanceTransactionSort,
  PaginatedFinanceTransactions,
} from '@control-os/types';
import { Button } from '@control-os/ui';
import { SectionHeader } from '@/components/dashboard/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { FloatingPanel } from '@/components/ui/floating-panel';
import { FormError } from '@/components/ui/form-error';
import { GlassCard } from '@/components/ui/glass-card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FinanceTransactionStatusBadge,
  TransactionDetailContent,
} from '@/components/finance/transaction-detail-content';
import {
  lifecycleActionLabel,
  TransactionLifecycleActions,
} from '@/components/finance/transaction-lifecycle-actions';
import {
  useCancelFinanceTransaction,
  useConfirmFinanceTransaction,
  useFinanceAccounts,
  useFinanceCategories,
  useFinanceTransaction,
  useFinanceTransactions,
  useReverseFinanceTransaction,
  type FinanceAccountDto,
} from '@/lib/finance';
import {
  executeFinanceLifecycleAction,
  lifecycleActionKey,
  type FinanceLifecycleAction,
} from '@/lib/finance/transaction-lifecycle-model';
import {
  buildFinanceTransactionFilters,
  INITIAL_TRANSACTION_FILTERS,
  type TransactionFilterState,
} from '@/lib/finance/transaction-list-model';
import { formatCurrency } from '@/lib/utils';

type TransactionListViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; page: PaginatedFinanceTransactions };

interface TransactionListViewProps {
  state: TransactionListViewState;
  filters: TransactionFilterState;
  accounts: FinanceAccountDto[];
  categories: Array<{ id: string; name: string }>;
  canGoBack: boolean;
  onFilterChange?: <K extends keyof TransactionFilterState>(key: K, value: TransactionFilterState[K]) => void;
  onNextPage?: () => void;
  onPreviousPage?: () => void;
  onSelectTransaction?: (id: string) => void;
  pendingKeys: ReadonlySet<string>;
  feedback?: TransactionLifecycleFeedback;
  onLifecycleAction?: (action: FinanceLifecycleAction, transactionId: string) => void;
}

type TransactionLifecycleFeedback =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

interface PendingConfirmation {
  action: 'cancel' | 'reverse';
  transactionId: string;
}

export default function FinanceTransactionsPage() {
  const [filters, setFilters] = React.useState<TransactionFilterState>(INITIAL_TRANSACTION_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [cursor, setCursor] = React.useState<string>();
  const [cursorHistory, setCursorHistory] = React.useState<Array<string | undefined>>([]);
  const [selectedId, setSelectedId] = React.useState<string>();
  const [pendingConfirmation, setPendingConfirmation] = React.useState<PendingConfirmation>();
  const [pendingKeys, setPendingKeys] = React.useState<Set<string>>(() => new Set());
  const [lifecycleFeedback, setLifecycleFeedback] = React.useState<TransactionLifecycleFeedback>();
  const lifecycleLocks = React.useRef(new Set<string>());

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const queryFilters = React.useMemo(
    () => buildFinanceTransactionFilters(filters, debouncedSearch, cursor),
    [cursor, debouncedSearch, filters]
  );
  const transactionsQuery = useFinanceTransactions(queryFilters);
  const accountsQuery = useFinanceAccounts(true);
  const categoriesQuery = useFinanceCategories();
  const transactionQuery = useFinanceTransaction(selectedId);
  const confirmTransaction = useConfirmFinanceTransaction();
  const cancelTransaction = useCancelFinanceTransaction();
  const reverseTransaction = useReverseFinanceTransaction();

  const executeLifecycleAction = React.useCallback(async (
    action: FinanceLifecycleAction,
    transactionId: string
  ) => {
    const mutation = action === 'confirm'
      ? confirmTransaction
      : action === 'cancel'
        ? cancelTransaction
        : reverseTransaction;
    setLifecycleFeedback(undefined);
    const result = await executeFinanceLifecycleAction({
      action,
      transactionId,
      locks: lifecycleLocks.current,
      execute: (id) => mutation.mutateAsync(id),
      onPendingChange: (key, pending) => {
        setPendingKeys((current) => {
          const next = new Set(current);
          if (pending) next.add(key); else next.delete(key);
          return next;
        });
      },
    });
    if (result.kind === 'success' || result.kind === 'error') {
      setLifecycleFeedback({ kind: result.kind, message: result.message });
    }
    if (result.kind === 'success') setPendingConfirmation(undefined);
  }, [cancelTransaction, confirmTransaction, reverseTransaction]);

  const requestLifecycleAction = React.useCallback((
    action: FinanceLifecycleAction,
    transactionId: string
  ) => {
    if (action === 'confirm') {
      void executeLifecycleAction(action, transactionId);
      return;
    }
    setPendingConfirmation({ action, transactionId });
    setLifecycleFeedback(undefined);
  }, [executeLifecycleAction]);

  const changeFilter = React.useCallback(<K extends keyof TransactionFilterState>(
    key: K,
    value: TransactionFilterState[K]
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setCursor(undefined);
    setCursorHistory([]);
  }, []);

  const goToNextPage = React.useCallback(() => {
    const nextCursor = transactionsQuery.data?.nextCursor;
    if (!nextCursor) return;
    setCursorHistory((history) => [...history, cursor]);
    setCursor(nextCursor);
  }, [cursor, transactionsQuery.data?.nextCursor]);

  const goToPreviousPage = React.useCallback(() => {
    setCursorHistory((history) => {
      if (history.length === 0) return history;
      const previousCursor = history[history.length - 1];
      setCursor(previousCursor);
      return history.slice(0, -1);
    });
  }, []);

  const state: TransactionListViewState = transactionsQuery.isPending
    ? { kind: 'loading' }
    : transactionsQuery.isError
      ? {
          kind: 'error',
          message: transactionsQuery.error.message || 'Não foi possível carregar as transações.',
        }
      : { kind: 'success', page: transactionsQuery.data };

  return (
    <>
      <TransactionListView
        state={state}
        filters={filters}
        accounts={accountsQuery.data ?? []}
        categories={categoriesQuery.data ?? []}
        canGoBack={cursorHistory.length > 0}
        onFilterChange={changeFilter}
        onNextPage={goToNextPage}
        onPreviousPage={goToPreviousPage}
        onSelectTransaction={setSelectedId}
        pendingKeys={pendingKeys}
        feedback={lifecycleFeedback}
        onLifecycleAction={requestLifecycleAction}
      />

      <FloatingPanel
        open={Boolean(selectedId)}
        onOpenChange={(open) => {
          if (!open) setSelectedId(undefined);
        }}
        title="Detalhes da transação"
        description="Dados persistidos e histórico disponível da transação selecionada."
        className="max-h-[calc(100vh-8rem)] overflow-y-auto"
      >
        <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-text-primary">Detalhes da transação</p>
            <p className="mt-0.5 text-xs text-text-tertiary">Dados e ações disponíveis</p>
          </div>
          <button
            type="button"
            onClick={() => setSelectedId(undefined)}
            aria-label="Fechar detalhes"
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {transactionQuery.isPending ? (
          <div className="space-y-4 p-5" aria-label="Carregando detalhes da transação">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24" />
            <Skeleton className="h-32" />
          </div>
        ) : transactionQuery.isError ? (
          <div className="p-5">
            <FormError message={transactionQuery.error.message || 'Não foi possível carregar a transação.'} />
          </div>
        ) : transactionQuery.data ? (
          <TransactionDetailContent
            transaction={transactionQuery.data}
            accountName={accountName(accountsQuery.data ?? [], transactionQuery.data.accountId)}
            actions={(
              <div className="space-y-3">
                <TransactionLifecycleFeedbackView feedback={lifecycleFeedback} />
                <TransactionLifecycleActions
                  transactionId={transactionQuery.data.id}
                  status={transactionQuery.data.status}
                  pendingKeys={pendingKeys}
                  onAction={requestLifecycleAction}
                />
              </div>
            )}
          />
        ) : null}
      </FloatingPanel>

      <LifecycleConfirmationPanel
        confirmation={pendingConfirmation}
        pendingKeys={pendingKeys}
        onClose={() => setPendingConfirmation(undefined)}
        onConfirm={(confirmation) => void executeLifecycleAction(confirmation.action, confirmation.transactionId)}
      />
    </>
  );
}

function TransactionListView({
  state,
  filters,
  accounts,
  categories,
  canGoBack,
  onFilterChange = () => undefined,
  onNextPage = () => undefined,
  onPreviousPage = () => undefined,
  onSelectTransaction = () => undefined,
  pendingKeys,
  feedback,
  onLifecycleAction = () => undefined,
}: TransactionListViewProps) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8 sm:px-8">
      <SectionHeader
        level="page"
        title="Transações"
        meta={state.kind === 'success' ? `${state.page.items.length} nesta página` : undefined}
      />

      <TransactionLifecycleFeedbackView feedback={feedback} />

      <GlassCard interactive={false} className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="relative md:col-span-2 xl:col-span-2">
            <span className="sr-only">Pesquisar transações</span>
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-text-tertiary" />
            <input
              value={filters.search}
              onChange={(event) => onFilterChange('search', event.target.value)}
              maxLength={120}
              placeholder="Buscar por descrição ou categoria"
              className="h-10 w-full rounded-lg border border-border-subtle bg-surface-0 pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-blue"
            />
          </label>
          <FilterSelect
            label="Tipo"
            value={filters.type}
            onChange={(value) => onFilterChange('type', value as TransactionFilterState['type'])}
            options={[
              ['', 'Todos os tipos'],
              ['receita', 'Receitas'],
              ['despesa', 'Despesas'],
              ['transferencia', 'Transferências'],
            ]}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(value) => onFilterChange('status', value as TransactionFilterState['status'])}
            options={[
              ['', 'Todos os status'],
              ['pendente', 'Pendentes'],
              ['confirmada', 'Confirmadas'],
              ['cancelada', 'Canceladas'],
              ['estornada', 'Estornadas'],
            ]}
          />
          <FilterSelect
            label="Conta"
            value={filters.accountId}
            onChange={(value) => onFilterChange('accountId', value)}
            options={[
              ['', 'Todas as contas'],
              ...accounts.map((account) => [account.id, account.name] as [string, string]),
            ]}
          />
          <FilterSelect
            label="Categoria"
            value={filters.categoryId}
            onChange={(value) => onFilterChange('categoryId', value)}
            options={[
              ['', 'Todas as categorias'],
              ...categories.map((category) => [category.id, category.name] as [string, string]),
            ]}
          />
          <label className="text-xs text-text-secondary">
            Competência inicial
            <input
              type="date"
              value={filters.competenceFrom}
              onChange={(event) => onFilterChange('competenceFrom', event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-accent-blue"
            />
          </label>
          <label className="text-xs text-text-secondary">
            Competência final
            <input
              type="date"
              value={filters.competenceTo}
              onChange={(event) => onFilterChange('competenceTo', event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-accent-blue"
            />
          </label>
          <FilterSelect
            label="Ordenar por data"
            value={filters.sort}
            onChange={(value) => onFilterChange('sort', value as FinanceTransactionSort)}
            options={[
              ['date_desc', 'Mais recentes'],
              ['date_asc', 'Mais antigas'],
            ]}
          />
        </div>
      </GlassCard>

      {state.kind === 'loading' ? (
        <TransactionListLoading />
      ) : state.kind === 'error' ? (
        <FormError message={state.message} />
      ) : state.page.items.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="Nenhuma transação encontrada."
          description="Ajuste os filtros ou registre uma movimentação para vê-la aqui."
        />
      ) : (
        <>
          <GlassCard interactive={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border-subtle text-xs text-text-tertiary">
                    <th className="px-4 py-3 font-medium">Descrição</th>
                    <th className="px-4 py-3 font-medium">Categoria</th>
                    <th className="px-4 py-3 font-medium">Competência</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {state.page.items.map((transaction) => (
                    <TransactionRow
                      key={transaction.id}
                      transaction={transaction}
                      onSelect={() => onSelectTransaction(transaction.id)}
                      pendingKeys={pendingKeys}
                      onLifecycleAction={onLifecycleAction}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <div className="flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={!canGoBack}
              onClick={onPreviousPage}
            >
              <ArrowLeft className="h-4 w-4" />
              Anterior
            </Button>
            <span className="text-xs text-text-tertiary">Paginação segura por cursor</span>
            <Button
              type="button"
              variant="secondary"
              disabled={!state.page.hasMore || !state.page.nextCursor}
              onClick={onNextPage}
            >
              Próxima
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </main>
  );
}

function TransactionRow({
  transaction,
  onSelect,
  pendingKeys,
  onLifecycleAction,
}: {
  transaction: FinanceTransactionDto;
  onSelect: () => void;
  pendingKeys: ReadonlySet<string>;
  onLifecycleAction: (action: FinanceLifecycleAction, transactionId: string) => void;
}) {
  const positive = transaction.type === 'receita'
    || (transaction.type === 'transferencia' && transaction.transferDirection === 'entrada');
  return (
    <tr className="transition-colors hover:bg-white/[0.025]">
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Abrir detalhes de ${transaction.description}`}
          className="max-w-[280px] truncate text-left text-sm font-medium text-text-primary hover:text-accent-blue"
        >
          {transaction.description}
        </button>
        <p className="mt-0.5 text-xs capitalize text-text-tertiary">{transaction.source}</p>
      </td>
      <td className="px-4 py-3 text-sm text-text-secondary">{transaction.category}</td>
      <td className="px-4 py-3 text-sm text-text-secondary">{formatDate(transaction.competenceDate ?? transaction.date)}</td>
      <td className="px-4 py-3">
        <FinanceTransactionStatusBadge status={transaction.status} />
      </td>
      <td className={`px-4 py-3 text-right font-mono text-sm ${positive ? 'text-accent-green' : 'text-accent-red'}`}>
        <div className="flex items-center justify-end gap-3">
          <span className="inline-flex items-center gap-1">
            {positive ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
            {formatCurrency(transaction.amount)}
          </span>
          <TransactionLifecycleActions
            transactionId={transaction.id}
            status={transaction.status}
            pendingKeys={pendingKeys}
            compact
            onAction={onLifecycleAction}
          />
        </div>
      </td>
    </tr>
  );
}

function TransactionLifecycleFeedbackView({ feedback }: { feedback?: TransactionLifecycleFeedback }) {
  if (!feedback) return null;
  if (feedback.kind === 'error') return <FormError message={feedback.message} />;
  return (
    <div role="status" className="flex items-center gap-2 rounded-md border border-accent-green/20 bg-accent-green/10 px-3 py-2 text-xs text-accent-green">
      <CheckCircle2 className="h-4 w-4" />
      {feedback.message}
    </div>
  );
}

function LifecycleConfirmationPanel({ confirmation, pendingKeys, onClose, onConfirm }: {
  confirmation?: PendingConfirmation;
  pendingKeys: ReadonlySet<string>;
  onClose: () => void;
  onConfirm: (confirmation: PendingConfirmation) => void;
}) {
  const label = confirmation ? lifecycleActionLabel(confirmation.action) : '';
  const pending = confirmation
    ? pendingKeys.has(lifecycleActionKey(confirmation.action, confirmation.transactionId))
    : false;
  return (
    <FloatingPanel
      open={Boolean(confirmation)}
      onOpenChange={(open) => { if (!open && !pending) onClose(); }}
      title={`${label} transação`}
      description="Confirme a ação antes de continuar. O histórico financeiro será preservado."
      className="max-w-md"
    >
      <div className="space-y-5 p-6">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{label} transação?</h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {confirmation?.action === 'reverse'
              ? 'O lançamento original será preservado e receberá um estorno auditável.'
              : 'A transação pendente será cancelada e continuará disponível no histórico.'}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>Voltar</Button>
          <Button
            type="button"
            variant={confirmation?.action === 'reverse' ? 'danger' : 'primary'}
            loading={pending}
            disabled={!confirmation || pending}
            onClick={() => { if (confirmation) onConfirm(confirmation); }}
          >
            {pending ? `${label}…` : `Confirmar ${label.toLowerCase()}`}
          </Button>
        </div>
      </div>
    </FloatingPanel>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs text-text-secondary">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-10 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 text-sm text-text-primary outline-none focus:border-accent-blue"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || 'all'} value={optionValue}>{optionLabel}</option>
        ))}
      </select>
    </label>
  );
}

function TransactionListLoading() {
  return (
    <div className="space-y-2" aria-label="Carregando transações">
      {[0, 1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-16 w-full" />)}
    </div>
  );
}

function accountName(accounts: FinanceAccountDto[], accountId?: string): string {
  if (!accountId) return 'Não informada';
  return accounts.find((account) => account.id === accountId)?.name ?? 'Conta não encontrada';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}
