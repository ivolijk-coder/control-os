-- Evolução "Parcelas & Empréstimos": cabeçalho de contrato financeiro
-- (empréstimo/financiamento/parcelamento de cartão/fornecedor) e suas
-- parcelas, por cima do domínio financeiro já existente. NÃO mexe em
-- `finance_transactions` nem no mecanismo de `installment_group_id` já
-- usado por `PersistentFinanceService.createInstallment` — os dois
-- convivem: uma parcela deste módulo só vira uma `Transaction` de verdade
-- quando é marcada como paga (`payment_transaction_id`, preenchido pela
-- aplicação, sem FK — mesmo padrão de `finance_fixed_account_occurrences.
-- transaction_id`).
--
-- Aditiva: cria só tipos e tabelas novas. Nenhuma tabela existente é
-- alterada.

CREATE TYPE "ContractType" AS ENUM ('LOAN', 'FINANCING', 'CARD_INSTALLMENT', 'SUPPLIER');
CREATE TYPE "ContractOrigin" AS ENUM ('PERSONAL', 'COMPANY');
CREATE TYPE "ContractSource" AS ENUM ('MANUAL', 'NOVA', 'DOCUMENT');
CREATE TYPE "ContractStatus" AS ENUM ('ACTIVE', 'FINISHED', 'CANCELLED');
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

CREATE TABLE "financial_contracts" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "institution" TEXT,
  "type" "ContractType" NOT NULL,
  "origin" "ContractOrigin" NOT NULL DEFAULT 'PERSONAL',
  "category_id" UUID,
  "account_id" UUID,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "financed_amount" DECIMAL(12,2),
  "installment_amount" DECIMAL(12,2) NOT NULL,
  "total_installments" INTEGER NOT NULL,
  "paid_installments" INTEGER NOT NULL DEFAULT 0,
  "due_day" INTEGER NOT NULL,
  "start_date" TIMESTAMPTZ(3) NOT NULL,
  "end_date" TIMESTAMPTZ(3),
  "interest_rate" DECIMAL(6,4),
  "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
  "source" "ContractSource" NOT NULL DEFAULT 'MANUAL',
  "document_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "financial_contracts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_contracts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "finance_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "financial_contracts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "finance_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "financial_contracts_user_id_status_idx" ON "financial_contracts"("user_id", "status");
CREATE INDEX "financial_contracts_document_id_idx" ON "financial_contracts"("document_id");

CREATE TABLE "financial_installments" (
  "id" UUID NOT NULL,
  "contract_id" UUID NOT NULL,
  "number" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "due_date" TIMESTAMPTZ(3) NOT NULL,
  "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
  "paid_at" TIMESTAMPTZ(3),
  "payment_transaction_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "financial_installments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "financial_installments_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "financial_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "financial_installments_contract_id_number_key" ON "financial_installments"("contract_id", "number");
CREATE INDEX "financial_installments_contract_id_status_idx" ON "financial_installments"("contract_id", "status");
CREATE INDEX "financial_installments_status_due_date_idx" ON "financial_installments"("status", "due_date");
