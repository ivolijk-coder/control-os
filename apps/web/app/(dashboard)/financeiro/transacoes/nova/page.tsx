import { SectionHeader } from '@/components/dashboard/section-header';
import { TransactionCreateForm } from '@/components/finance/transaction-create-form';

export default function NewFinanceTransactionPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-5 py-8 sm:px-8">
      <SectionHeader
        level="page"
        title="Nova transação"
        description="Registre uma receita, despesa ou transferência usando suas contas e categorias reais."
      />
      <TransactionCreateForm />
    </main>
  );
}
