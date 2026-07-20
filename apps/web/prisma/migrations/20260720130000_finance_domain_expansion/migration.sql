-- CONTROL OS — Fase 7: Financeiro completo (contas, categorias,
-- transferências, parcelamentos, recorrências).
--
-- Escrita à mão neste ambiente pelo mesmo motivo da migration anterior
-- (`20260720120000_init_finance`): sandbox sem acesso à registry do npm,
-- sem CLI do Prisma disponível aqui. SQL padrão que `prisma migrate dev`
-- geraria a partir do `schema.prisma` desta fase.
--
-- ATENÇÃO — `ALTER TYPE ... ADD VALUE`: Postgres (12+, este projeto usa
-- 16-alpine) permite isto dentro de uma transação, mas o valor novo não
-- pode ser USADO na mesma transação em que foi adicionado. Este arquivo
-- não usa 'TRANSFER' em nenhum INSERT/UPDATE — só adiciona o valor — então
-- é seguro rodar como está. Se o seu client/migration runner envolver todo
-- o arquivo numa transação (comportamento padrão do Prisma), isto funciona
-- sem ajuste nenhum.

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER';

-- CreateEnum
CREATE TYPE "TransferDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('CARTEIRA', 'CONTA_CORRENTE', 'POUPANCA', 'CARTAO_CREDITO', 'OUTRO');

-- AlterTable — finance_accounts ganha "kind" (classificação opcional, default OUTRO)
ALTER TABLE "finance_accounts" ADD COLUMN "kind" "AccountKind" NOT NULL DEFAULT 'OUTRO';

-- AlterTable — finance_transactions ganha campos de transferência e parcelamento
ALTER TABLE "finance_transactions" ADD COLUMN "transfer_group_id" UUID;
ALTER TABLE "finance_transactions" ADD COLUMN "transfer_direction" "TransferDirection";
ALTER TABLE "finance_transactions" ADD COLUMN "installment_group_id" UUID;
ALTER TABLE "finance_transactions" ADD COLUMN "installment_number" INTEGER;
ALTER TABLE "finance_transactions" ADD COLUMN "installment_total" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "finance_accounts_user_id_name_key" ON "finance_accounts"("user_id", "name");

-- CreateIndex
CREATE INDEX "finance_transactions_user_id_account_id_idx" ON "finance_transactions"("user_id", "account_id");

-- CreateIndex
CREATE INDEX "finance_transactions_transfer_group_id_idx" ON "finance_transactions"("transfer_group_id");

-- CreateIndex
CREATE INDEX "finance_transactions_installment_group_id_idx" ON "finance_transactions"("installment_group_id");
