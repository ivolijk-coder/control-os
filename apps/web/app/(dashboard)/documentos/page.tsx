'use client';

import * as React from 'react';
import { Check, FileText, Loader2, Paperclip, Upload, X } from 'lucide-react';
import { FadeIn } from '@/components/dashboard/fade-in';
import { GlassCard } from '@/components/ui/glass-card';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/dashboard/section-header';

type DocumentType = 'CONTRACT_SOCIAL' | 'FINANCING_CONTRACT' | 'LOAN_CONTRACT' | 'INVOICE' | 'RECEIPT' | 'PAYMENT_PROOF' | 'TAX_DOCUMENT' | 'PERSONAL_DOCUMENT' | 'LEGAL_DOCUMENT' | 'OTHER';
type DocumentEntities = { company?: string | null; people?: string[]; dates?: string[]; amounts?: number[] };

type Extraction = {
  documentType?: DocumentType;
  confidence?: 'high' | 'medium' | 'low';
  entities?: DocumentEntities;
  suggestedActions?: string[];
  creditorName?: string | null;
  summary?: string | null;
  totalAmount?: number | null;
  installmentAmount?: number | null;
  installments?: number | null;
  firstDueDate?: string | null;
  notes?: string[];
};

type Proposal = { id: string; status: 'PENDING' | 'READY_FOR_REVIEW' | 'PROCESSING' | 'CONFIRMED' | 'REJECTED' | 'DISCARDED' | 'ARCHIVED' | 'FAILED'; extractedData: Extraction; validationWarnings?: string[] };
type DocumentItem = {
  id: string; title: string; originalFileName: string; mimeType: string; sizeBytes: number; kind: 'GENERAL' | 'CONTRACT'; createdAt: string;
  importProposals: Proposal[]; analysisStatus?: string; analysisErrorMessage?: string | null; scanStatus?: string; storageStatus?: string;
};
type Account = { id: string; name: string; status?: string };
type Category = { id: string; name: string; kind: string; archivedAt?: string | null };

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  CONTRACT_SOCIAL: 'Contrato Social', FINANCING_CONTRACT: 'Contrato de Financiamento', LOAN_CONTRACT: 'Contrato de Empréstimo',
  INVOICE: 'Nota Fiscal', RECEIPT: 'Recibo', PAYMENT_PROOF: 'Comprovante de Pagamento', TAX_DOCUMENT: 'Documento Fiscal',
  PERSONAL_DOCUMENT: 'Documento Pessoal', LEGAL_DOCUMENT: 'Documento Jurídico', OTHER: 'Documento',
};
const CONFIDENCE_LABELS: Record<'high' | 'medium' | 'low', string> = { high: 'alta', medium: 'média', low: 'baixa' };

function formatDate(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value)); }
function formatMoney(value: number | null | undefined) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0)); }
function formatBytes(value: number) { return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`; }
/** Espelha isFinancialInstallmentProposal() do backend (contract-analysis.ts):
 * só mostramos o cartão de confirmação financeira quando há credor, valor
 * total e pelo menos 2 parcelas — os mesmos campos flat que
 * confirm/route.ts exige. Sem isso, o documento é tratado como memória
 * (resumo/classificação), nunca como proposta acionável. */
function canConfirmFinancial(extraction?: Extraction): boolean {
  return Boolean(extraction?.creditorName) && extraction?.totalAmount != null && extraction?.installments != null && extraction.installments >= 2;
}

/** Biblioteca privada de documentos. Contratos são apenas propostas até o
 * usuário revisar e confirmar explicitamente os dados financeiros. Todo
 * documento analisado (financeiro ou não) fica com classificação e resumo
 * guardados — a biblioteca funciona como memória pesquisável, não só como
 * armazenamento de arquivos. */
export default function DocumentosPage() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = React.useState<DocumentItem[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [query, setQuery] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isUploading, setIsUploading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [selectionByProposal, setSelectionByProposal] = React.useState<Record<string, { accountId: string; categoryId: string }>>({});

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [docsResponse, accountsResponse, categoriesResponse] = await Promise.all([
        fetch('/api/documents'), fetch('/api/finance/accounts'), fetch('/api/finance/categories'),
      ]);
      const [docsPayload, accountsPayload, categoriesPayload] = await Promise.all([
        docsResponse.json(), accountsResponse.json(), categoriesResponse.json(),
      ]) as Array<{ documents?: DocumentItem[]; accounts?: Account[]; categories?: Category[] }>;
      setDocuments(docsPayload?.documents ?? []);
      setAccounts((accountsPayload?.accounts ?? []).filter((account) => account.status !== 'arquivada'));
      setCategories((categoriesPayload?.categories ?? []).filter((category) => category.kind === 'despesa' && !category.archivedAt));
    } catch {
      setMessage('Não foi possível carregar seus documentos agora.');
    } finally { setIsLoading(false); }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const upload = async (file: File) => {
    setIsUploading(true); setMessage(null);
    try {
      const data = new FormData(); data.set('file', file);
      const response = await fetch('/api/documents', { method: 'POST', body: data });
      const payload = await response.json() as { success?: boolean; message?: string; document?: { id: string; kind: string } };
      if (!response.ok || !payload.success || !payload.document) throw new Error(payload.message ?? 'Não consegui guardar este arquivo.');
      if (payload.document.kind === 'CONTRACT') {
        const analysis = await fetch(`/api/documents/${payload.document.id}/contract-proposal`, { method: 'POST' });
        const analysisPayload = await analysis.json() as { success?: boolean; message?: string };
        if (!analysis.ok || !analysisPayload.success) throw new Error(analysisPayload.message ?? 'O arquivo foi guardado, mas não foi possível iniciar a análise agora.');
        setMessage('Contrato guardado. A análise foi colocada na fila e só ficará disponível depois da verificação de segurança. Nenhum dado financeiro foi criado.');
      } else setMessage('Arquivo guardado na sua biblioteca privada.');
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível guardar este arquivo.'); }
    finally { setIsUploading(false); }
  };

  const confirmProposal = async (proposalId: string) => {
    const selection = selectionByProposal[proposalId];
    if (!selection?.accountId || !selection.categoryId) { setMessage('Escolha a conta de origem e a categoria antes de confirmar.'); return; }
    const response = await fetch(`/api/documents/proposals/${proposalId}/confirm`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(selection) });
    const payload = await response.json() as { ok?: boolean; error?: string; message?: string };
    setMessage(response.ok && payload.ok ? 'Parcelamento criado com sucesso a partir do contrato confirmado.' : (payload.error ?? payload.message ?? 'Não foi possível confirmar o contrato.'));
    if (response.ok && payload.ok) await load();
  };

  const rejectProposal = async (proposalId: string) => {
    const response = await fetch(`/api/documents/proposals/${proposalId}/reject`, { method: 'POST' });
    const payload = await response.json() as { ok?: boolean; error?: string };
    setMessage(response.ok && payload.ok ? 'Importação descartada. O arquivo continua guardado na sua biblioteca.' : (payload.error ?? 'Não foi possível descartar a prévia.'));
    if (response.ok && payload.ok) await load();
  };

  const visibleDocuments = documents.filter((document) => `${document.title} ${document.originalFileName}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-7 sm:px-8">
      <FadeIn><SectionHeader level="page" title="Documentos" meta={`${documents.length} guardado${documents.length === 1 ? '' : 's'}`} /></FadeIn>
      <FadeIn delay={0.03}>
        <GlassCard interactive={false} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-base font-medium text-text-primary">Sua biblioteca privada</p><p className="mt-1 max-w-2xl text-sm text-text-secondary">Envie contratos, comprovantes e documentos pessoais. PDFs de contratos geram uma prévia para sua confirmação — nada financeiro é criado automaticamente.</p></div>
          <input ref={inputRef} className="hidden" type="file" accept="application/pdf,image/png,image/jpeg,image/webp,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ''; }} />
          <button onClick={() => inputRef.current?.click()} disabled={isUploading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50">{isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{isUploading ? 'Guardando...' : 'Enviar arquivo'}</button>
        </GlassCard>
      </FadeIn>
      {message && <p role="status" className="rounded-xl border border-accent-blue/20 bg-accent-blue/10 px-4 py-3 text-sm text-text-primary">{message}</p>}
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome do arquivo..." className="w-full rounded-xl border border-white/[0.1] bg-card/70 px-4 py-3 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-accent-blue/50" />
      {isLoading ? <div className="flex items-center justify-center py-20 text-text-secondary"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando documentos...</div> : visibleDocuments.length === 0 ? <EmptyState icon={FileText} title={documents.length === 0 ? 'Nenhum documento ainda.' : 'Nenhum documento encontrado.'} /> : <div className="flex flex-col gap-4">{visibleDocuments.map((document) => {
        const proposal = document.importProposals[0]; const extraction = proposal?.extractedData; const selection = proposal ? selectionByProposal[proposal.id] ?? { accountId: '', categoryId: '' } : undefined;
        const financialActionable = Boolean(proposal) && (proposal!.status === 'PENDING' || proposal!.status === 'READY_FOR_REVIEW') && canConfirmFinancial(extraction);
        const showsClassificationCard = Boolean(proposal && extraction && !financialActionable && proposal.status !== 'CONFIRMED' && proposal.status !== 'REJECTED' && proposal.status !== 'DISCARDED');
        return <GlassCard key={document.id} interactive={false} className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-accent-blue"><FileText className="h-5 w-5" /></span><div><p className="truncate text-base font-medium text-text-primary">{document.title}</p><p className="mt-1 text-xs text-text-tertiary">{document.originalFileName} · {formatBytes(document.sizeBytes)} · {formatDate(document.createdAt)}</p>{document.kind === 'CONTRACT' && <span className="mt-2 inline-flex rounded-full border border-accent-gold/25 bg-accent-gold/10 px-2 py-0.5 text-[11px] font-medium text-accent-gold">Contrato</span>}</div></div><a href={`/api/documents/${document.id}/download`} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] px-3 py-2 text-sm text-text-primary hover:bg-white/[0.06]"><Paperclip className="h-4 w-4" /> Baixar</a></div>
          {financialActionable && extraction && <div className="mt-5 rounded-xl border border-accent-gold/25 bg-accent-gold/[0.06] p-4"><p className="text-sm font-medium text-text-primary">Prévia para sua confirmação</p><p className="mt-1 text-xs text-text-secondary">Confira os dados extraídos do contrato. Só ao confirmar será criado um parcelamento.</p><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-text-tertiary">Credor</dt><dd className="mt-0.5 text-text-primary">{extraction.creditorName ?? 'Não identificado'}</dd></div><div><dt className="text-text-tertiary">Total</dt><dd className="mt-0.5 text-text-primary">{formatMoney(extraction.totalAmount)}</dd></div><div><dt className="text-text-tertiary">Parcelas</dt><dd className="mt-0.5 text-text-primary">{extraction.installments ?? '—'} de {formatMoney(extraction.installmentAmount)}</dd></div></dl>{proposal!.validationWarnings?.length ? <p className="mt-3 text-xs text-accent-gold">Revise: {proposal!.validationWarnings.join(' ')}</p> : null}{extraction.summary && <p className="mt-3 text-sm text-text-secondary">{extraction.summary}</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-text-secondary">Conta de origem<select value={selection?.accountId ?? ''} onChange={(event) => setSelectionByProposal((current) => ({ ...current, [proposal!.id]: { ...selection!, accountId: event.target.value } }))} className="mt-1.5 w-full rounded-lg border border-white/[0.1] bg-card px-3 py-2 text-sm text-text-primary"><option value="">Escolha a conta</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className="text-xs text-text-secondary">Categoria<select value={selection?.categoryId ?? ''} onChange={(event) => setSelectionByProposal((current) => ({ ...current, [proposal!.id]: { ...selection!, categoryId: event.target.value } }))} className="mt-1.5 w-full rounded-lg border border-white/[0.1] bg-card px-3 py-2 text-sm text-text-primary"><option value="">Escolha a categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => void confirmProposal(proposal!.id)} className="inline-flex items-center gap-2 rounded-lg bg-accent-gold px-3 py-2 text-sm font-medium text-black"><Check className="h-4 w-4" /> Confirmar parcelamento</button><button onClick={() => void rejectProposal(proposal!.id)} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] px-3 py-2 text-sm text-text-primary hover:bg-white/[0.06]"><X className="h-4 w-4" /> Descartar prévia</button></div></div>}
          {showsClassificationCard && extraction && <div className="mt-5 rounded-xl border border-white/[0.1] bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-accent-green/25 bg-accent-green/10 px-2 py-0.5 text-[11px] font-medium text-accent-green">✅ Analisado</span>
              <span className="inline-flex rounded-full border border-white/[0.12] px-2 py-0.5 text-[11px] font-medium text-text-secondary">{DOCUMENT_TYPE_LABELS[extraction.documentType ?? 'OTHER']}</span>
              {extraction.confidence && <span className="inline-flex rounded-full border border-white/[0.12] px-2 py-0.5 text-[11px] font-medium text-text-tertiary">Confiança {CONFIDENCE_LABELS[extraction.confidence]}</span>}
              {proposal!.status !== 'ARCHIVED' && <span className="inline-flex rounded-full border border-accent-blue/25 bg-accent-blue/10 px-2 py-0.5 text-[11px] font-medium text-accent-blue">Aguardando sua confirmação</span>}
            </div>
            {extraction.summary && <p className="mt-3 text-sm text-text-secondary">{extraction.summary}</p>}
            {(extraction.entities?.company || extraction.entities?.people?.length || extraction.entities?.dates?.length || extraction.entities?.amounts?.length) ? (
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                {extraction.entities?.company && <div><dt className="text-text-tertiary">Empresa</dt><dd className="mt-0.5 text-text-primary">{extraction.entities.company}</dd></div>}
                {!!extraction.entities?.people?.length && <div><dt className="text-text-tertiary">Pessoas</dt><dd className="mt-0.5 text-text-primary">{extraction.entities.people.join(', ')}</dd></div>}
                {!!extraction.entities?.dates?.length && <div><dt className="text-text-tertiary">Datas</dt><dd className="mt-0.5 text-text-primary">{extraction.entities.dates.join(', ')}</dd></div>}
                {!!extraction.entities?.amounts?.length && <div><dt className="text-text-tertiary">Valores citados</dt><dd className="mt-0.5 text-text-primary">{extraction.entities.amounts.map((amount) => formatMoney(amount)).join(', ')}</dd></div>}
              </dl>
            ) : null}
            {!!extraction.suggestedActions?.length && <div className="mt-3 flex flex-wrap gap-2">{extraction.suggestedActions.map((action, index) => <span key={index} className="rounded-full border border-accent-blue/25 bg-accent-blue/10 px-2 py-1 text-xs text-accent-blue">{action}</span>)}</div>}
            {proposal!.status !== 'ARCHIVED' && proposal!.validationWarnings?.length ? <p className="mt-3 text-xs text-accent-gold">{proposal!.validationWarnings.join(' ')}</p> : null}
            {proposal!.status !== 'ARCHIVED' && <div className="mt-4"><button onClick={() => void rejectProposal(proposal!.id)} className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] px-3 py-2 text-sm text-text-primary hover:bg-white/[0.06]"><X className="h-4 w-4" /> Descartar</button></div>}
          </div>}
          {document.analysisStatus === 'QUEUED' || document.analysisStatus === 'PROCESSING' ? <p className="mt-4 text-sm text-text-secondary">A análise está em andamento. Atualize esta página em alguns instantes para revisar a prévia.</p> : null}
          {document.analysisStatus === 'NEEDS_REVIEW' && !showsClassificationCard && !financialActionable ? <p className="mt-4 text-sm text-accent-gold">O documento foi guardado, mas aguarda a verificação de segurança antes da análise.</p> : null}
          {document.analysisStatus === 'FAILED' ? <p className="mt-4 text-sm text-accent-red">A análise falhou: {document.analysisErrorMessage ?? 'tente novamente mais tarde.'}</p> : null}
          {proposal?.status === 'CONFIRMED' && <p className="mt-4 text-sm text-accent-green">Este contrato já foi confirmado e gerou um parcelamento.</p>}
        </GlassCard>;
      })}</div>}
    </div>
  );
}
