'use client';

import * as React from 'react';
import { Archive, CalendarClock, Plus, RotateCcw } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

type Account = { id: string; name: string; status: string };
type Category = { id: string; name: string; kind: 'receita' | 'despesa'; status: string };
type FixedAccount = {
  id: string; name: string; description?: string; type: 'receita' | 'despesa'; categoryId: string;
  sourceAccountId?: string; destinationAccountId?: string; paymentMethod: string; amount: number;
  recurrence: string; dueDay: number; startDate: string; endDate?: string; active: boolean; archivedAt?: string;
};
type FixedAccountsResponse = { success: boolean; message?: string; accounts?: FixedAccount[] };
type AccountsResponse = { success: boolean; message?: string; accounts?: Account[] };
type CategoriesResponse = { success: boolean; message?: string; categories?: Category[] };

const paymentMethods = [
  ['conta_bancaria', 'Conta bancária'], ['pix', 'PIX'], ['boleto', 'Boleto'], ['dinheiro', 'Dinheiro'], ['outro', 'Outro'],
] as const;

export default function FixedAccountsPage() {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [items, setItems] = React.useState<FixedAccount[]>([]);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [showArchived, setShowArchived] = React.useState(false);
  const [type, setType] = React.useState<'despesa' | 'receita'>('despesa');
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [accountId, setAccountId] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState('conta_bancaria');
  const [dueDay, setDueDay] = React.useState('10');

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [fixedResponse, accountsResponse, categoriesResponse] = await Promise.all([
        fetch(`/api/finance/fixed-accounts?includeArchived=${showArchived}`), fetch('/api/finance/accounts'), fetch('/api/finance/categories'),
      ]);
      const [fixed, accountData, categoryData] = await Promise.all([
        fixedResponse.json() as Promise<FixedAccountsResponse>,
        accountsResponse.json() as Promise<AccountsResponse>,
        categoriesResponse.json() as Promise<CategoriesResponse>,
      ]);
      if (!fixedResponse.ok || !fixed.success) throw new Error(fixed.message ?? 'Não foi possível carregar as contas fixas.');
      setItems(fixed.accounts ?? []);
      setAccounts((accountData.accounts ?? []).filter((account) => account.status === 'ativa'));
      setCategories((categoryData.categories ?? []).filter((category) => category.status === 'ativa'));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível carregar os dados.'); }
    finally { setLoading(false); }
  }, [showArchived]);

  React.useEffect(() => { void load(); }, [load]);
  React.useEffect(() => { const first = categories.find((category) => category.kind === type); setCategoryId(first?.id ?? ''); }, [type, categories]);

  const visibleCategories = categories.filter((category) => category.kind === type);
  const isBankAccount = paymentMethod === 'conta_bancaria';

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault(); setMessage(null);
    const parsedAmount = Number(amount.replace(',', '.'));
    const parsedDay = Number(dueDay);
    if (!(parsedAmount > 0) || !Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) { setMessage('Informe valor e vencimento válidos.'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/finance/fixed-accounts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type, amount: parsedAmount, categoryId, paymentMethod, dueDay: parsedDay, startDate: new Date().toISOString().slice(0, 10), ...(type === 'despesa' ? { sourceAccountId: accountId || undefined } : { destinationAccountId: accountId || undefined }) }),
      });
      const data = await response.json() as { success: boolean; message?: string };
      if (!response.ok || !data.success) throw new Error(data.message ?? 'Não foi possível salvar a conta fixa.');
      setMessage('Conta fixa criada. As próximas ocorrências foram geradas com este snapshot.'); setName(''); setAmount(''); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  }

  async function changeArchive(item: FixedAccount): Promise<void> {
    const action = item.archivedAt ? 'restore' : 'archive';
    if (!item.archivedAt && !window.confirm(`Arquivar “${item.name}”? O histórico será preservado.`)) return;
    const response = await fetch(`/api/finance/fixed-accounts/${item.id}/${action}`, { method: 'POST' });
    const data = await response.json() as { success: boolean; message?: string };
    setMessage(data.message ?? (data.success ? 'Conta atualizada.' : 'Não foi possível atualizar.'));
    if (data.success) await load();
  }

  return <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8">
    <header className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-blue">Financeiro</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">Contas fixas</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-text-secondary">Cadastros recorrentes. Cada mês gera uma ocorrência imutável; pagar sempre cria uma transação real.</p></div>
      <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} /> Mostrar arquivadas</label>
    </header>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-3">{loading ? <div className="rounded-2xl border border-border-subtle bg-surface-1 p-6 text-sm text-text-secondary">Carregando contas fixas…</div> : items.length === 0 ? <div className="rounded-2xl border border-dashed border-border-subtle bg-surface-1 p-8 text-center"><CalendarClock className="mx-auto h-6 w-6 text-accent-blue" /><p className="mt-3 font-medium text-text-primary">Nenhuma conta fixa cadastrada</p><p className="mt-1 text-sm text-text-secondary">Ex.: internet, aluguel, salário ou uma assinatura.</p></div> : items.map((item) => <article key={item.id} className={`flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface-1 p-5 sm:flex-row sm:items-center sm:justify-between ${item.archivedAt ? 'opacity-60' : ''}`}><div><p className="font-medium text-text-primary">{item.name}</p><p className="mt-1 text-sm text-text-secondary">{item.type === 'despesa' ? 'Despesa' : 'Receita'} · vence dia {item.dueDay} · {item.recurrence}</p><p className="mt-1 text-xs text-text-tertiary">{item.paymentMethod.replaceAll('_', ' ')} · ocorrências já geradas não mudam com futuras edições.</p></div><div className="flex items-center gap-3"><span className={item.type === 'despesa' ? 'font-semibold text-accent-red' : 'font-semibold text-accent-green'}>{formatCurrency(item.amount)}</span><button onClick={() => void changeArchive(item)} className="rounded-lg p-2 text-text-secondary hover:bg-white/[0.06]">{item.archivedAt ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</button></div></article>)}</section>
      <section className="h-fit rounded-2xl border border-border-subtle bg-surface-1 p-5"><div className="mb-5 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-blue/10 text-accent-blue"><Plus className="h-4 w-4" /></span><h2 className="font-medium text-text-primary">Nova conta fixa</h2></div><form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <label className="block text-sm text-text-secondary">Nome<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Internet" className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary" /></label>
        <div className="grid grid-cols-2 gap-3"><label className="text-sm text-text-secondary">Tipo<select value={type} onChange={(event) => setType(event.target.value as 'despesa' | 'receita')} className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary"><option value="despesa">Despesa</option><option value="receita">Receita</option></select></label><label className="text-sm text-text-secondary">Valor<input required inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary" /></label></div>
        <label className="block text-sm text-text-secondary">Categoria<select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary"><option value="">Selecione</option>{visibleCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        <label className="block text-sm text-text-secondary">Forma de pagamento<select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary">{paymentMethods.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="block text-sm text-text-secondary">{type === 'despesa' ? 'Conta de origem' : 'Conta de destino'}<select required={isBankAccount} value={accountId} onChange={(event) => setAccountId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary"><option value="">{isBankAccount ? 'Selecione' : 'Não definida'}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <label className="block text-sm text-text-secondary">Dia de vencimento<input required min="1" max="31" type="number" value={dueDay} onChange={(event) => setDueDay(event.target.value)} className="mt-1.5 w-full rounded-lg border border-border-subtle bg-surface-0 px-3 py-2.5 text-text-primary" /></label>
        {message && <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-text-secondary">{message}</p>}<button disabled={saving} className="rounded-lg bg-accent-blue px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Salvando…' : 'Criar conta fixa'}</button>
      </form></section>
    </div>
  </main>;
}
