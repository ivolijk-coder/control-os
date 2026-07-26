'use client';

import * as React from 'react';
import { Archive, Landmark, Pencil, Plus, RotateCcw } from 'lucide-react';
import type { FinanceAccount, FinanceAccountKind } from '@control-os/types';
import { cn, formatCurrency } from '@/lib/utils';

type AccountWithBalance = FinanceAccount & { balance: number };

const ACCOUNT_KINDS: Array<{ value: FinanceAccountKind; label: string }> = [
  { value: 'conta_corrente', label: 'Conta corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'carteira', label: 'Carteira' },
  { value: 'outro', label: 'Outra conta' },
];

function centsFromInput(value: string): number | undefined {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  if (!normalized) return 0;
  const amount = Number(normalized);
  if (!Number.isFinite(amount)) return undefined;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : undefined;
}

function amountForInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

export default function BankAccountsPage() {
  const [accounts, setAccounts] = React.useState<AccountWithBalance[]>([]);
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<AccountWithBalance | null>(null);
  const [name, setName] = React.useState('');
  const [kind, setKind] = React.useState<FinanceAccountKind>('conta_corrente');
  const [currency, setCurrency] = React.useState('BRL');
  const [initialBalance, setInitialBalance] = React.useState('0,00');
  const [openingBalanceDate, setOpeningBalanceDate] = React.useState(() => new Date().toISOString().slice(0, 10));

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/finance/accounts?includeArchived=${includeArchived}`);
      const data = await response.json() as { success: boolean; accounts?: AccountWithBalance[]; message?: string };
      if (!response.ok || !data.success) throw new Error(data.message ?? 'Não foi possível carregar suas contas.');
      setAccounts(data.accounts ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar suas contas.');
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  React.useEffect(() => { void load(); }, [load]);

  function resetForm(): void {
    setEditing(null);
    setName('');
    setKind('conta_corrente');
    setCurrency('BRL');
    setInitialBalance('0,00');
    setOpeningBalanceDate(new Date().toISOString().slice(0, 10));
  }

  function beginEdit(account: AccountWithBalance): void {
    setEditing(account);
    setName(account.name);
    setKind(account.kind);
    setCurrency(account.currency);
    setInitialBalance('');
    setMessage(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setMessage(null);
    const initialBalanceCents = centsFromInput(initialBalance);
    if (initialBalanceCents === undefined) { setMessage('Informe um saldo inicial válido.'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/finance/accounts', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing
          ? { id: editing.id, action: 'update', name, currency }
          : { name, kind, currency, initialBalanceCents, openingBalanceDate: `${openingBalanceDate}T12:00:00.000Z` }),
      });
      const data = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !data.success) throw new Error(data.message ?? 'Não foi possível salvar a conta.');
      setMessage(data.message ?? 'Conta salva.');
      resetForm();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível salvar a conta.');
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(account: AccountWithBalance): Promise<void> {
    const archiving = account.status === 'ativa';
    if (archiving && !window.confirm(`Arquivar “${account.name}”? O histórico será preservado.`)) return;
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/finance/accounts', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account.id, action: archiving ? 'archive' : 'restore' }),
      });
      const data = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !data.success) throw new Error(data.message ?? 'Não foi possível alterar a conta.');
      setMessage(data.message ?? 'Conta atualizada.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível alterar a conta.');
    } finally { setSaving(false); }
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-blue">Financeiro</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">Contas bancárias</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Crie e organize as contas que recebem suas movimentações. O saldo é sempre calculado pelos lançamentos, nunca digitado como valor fixo.</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={includeArchived} onChange={(event) => setIncludeArchived(event.target.checked)} /> Mostrar arquivadas</label>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-3" aria-live="polite">
          {loading ? <p className="rounded-xl border border-border-subtle bg-surface-1 p-6 text-sm text-text-secondary">Carregando contas…</p> : accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-1 p-8 text-center"><Landmark className="mx-auto h-6 w-6 text-accent-blue" /><h2 className="mt-3 font-medium text-text-primary">Nenhuma conta cadastrada</h2><p className="mt-1 text-sm text-text-secondary">Comece criando uma conta para registrar saldo e movimentações reais.</p></div>
          ) : accounts.map((account) => (
            <article key={account.id} className={cn('flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-1 p-5 sm:flex-row sm:items-center sm:justify-between', account.status === 'arquivada' && 'opacity-65')}>
              <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-blue/10 text-accent-blue"><Landmark className="h-5 w-5" /></span><div className="min-w-0"><h2 className="truncate font-medium text-text-primary">{account.name}</h2><p className="mt-1 text-sm text-text-secondary">{ACCOUNT_KINDS.find((item) => item.value === account.kind)?.label ?? 'Conta'} · {account.currency} · {account.status === 'ativa' ? 'Ativa' : 'Arquivada'}</p></div></div>
              <div className="flex items-center justify-between gap-3 sm:justify-end"><span className={cn('text-lg font-semibold', account.balance < 0 ? 'text-danger' : 'text-success')}>{formatCurrency(account.balance)}</span><button onClick={() => beginEdit(account)} disabled={saving} className="rounded-lg p-2 text-text-secondary hover:bg-white/[0.06] hover:text-text-primary" aria-label={`Editar ${account.name}`}><Pencil className="h-4 w-4" /></button><button onClick={() => void changeStatus(account)} disabled={saving} className="rounded-lg p-2 text-text-secondary hover:bg-white/[0.06] hover:text-text-primary" aria-label={account.status === 'ativa' ? `Arquivar ${account.name}` : `Restaurar ${account.name}`}>{account.status === 'ativa' ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}</button></div>
            </article>
          ))}
        </section>

        <section className="h-fit rounded-2xl border border-border-subtle bg-surface-1 p-5">
          <div className="mb-5 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue/10 text-accent-blue">{editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}</span><h2 className="font-medium text-text-primary">{editing ? 'Editar conta' : 'Nova conta'}</h2></div>
          <form className="space-y-4" onSubmit={(event) => void submit(event)}>
            <label className="block text-sm text-text-secondary">Nome<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Nubank" className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary outline-none focus:border-accent-blue" /></label>
            {!editing && <label className="block text-sm text-text-secondary">Tipo<select value={kind} onChange={(event) => setKind(event.target.value as FinanceAccountKind)} className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary outline-none focus:border-accent-blue">{ACCOUNT_KINDS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>}
            <label className="block text-sm text-text-secondary">Moeda<input required maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())} className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary outline-none focus:border-accent-blue" /></label>
            {!editing && <><label className="block text-sm text-text-secondary">Saldo inicial<input inputMode="decimal" value={initialBalance} onChange={(event) => setInitialBalance(event.target.value)} placeholder="0,00" className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary outline-none focus:border-accent-blue" /></label><label className="block text-sm text-text-secondary">Data do saldo inicial<input type="date" value={openingBalanceDate} onChange={(event) => setOpeningBalanceDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary outline-none focus:border-accent-blue" /></label></>}
            {message && <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-text-secondary">{message}</p>}
            <div className="flex gap-2"><button disabled={saving} type="submit" className="rounded-lg bg-accent-blue px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-blue/90 disabled:opacity-50">{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar conta'}</button>{editing && <button type="button" onClick={resetForm} className="rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-white/[0.05]">Cancelar</button>}</div>
          </form>
        </section>
      </div>
    </main>
  );
}
