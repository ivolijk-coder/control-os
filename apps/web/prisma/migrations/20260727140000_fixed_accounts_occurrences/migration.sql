-- Sprint 3.0 — regras recorrentes e ocorrências imutáveis (após o núcleo de transações).
-- Migration estritamente aditiva: não altera nem remove lançamentos existentes.

CREATE TYPE "FixedAccountRecurrence" AS ENUM ('MONTHLY', 'WEEKLY', 'YEARLY', 'CUSTOM');
CREATE TYPE "FixedAccountPaymentMethod" AS ENUM ('BANK_ACCOUNT', 'CREDIT_CARD', 'CASH', 'PIX', 'BOLETO', 'OTHER');
CREATE TYPE "FixedAccountOccurrenceStatus" AS ENUM ('PENDING', 'PAID', 'PARTIAL', 'CANCELLED');
CREATE TYPE "FixedAccountReconciliationStatus" AS ENUM ('MATCHED', 'REVIEW_REQUIRED');

CREATE TABLE "finance_fixed_accounts" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "TransactionType" NOT NULL,
  "category_id" UUID NOT NULL,
  "source_account_id" UUID,
  "destination_account_id" UUID,
  "payment_method" "FixedAccountPaymentMethod" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "recurrence" "FixedAccountRecurrence" NOT NULL,
  "custom_interval_days" INTEGER,
  "due_day" INTEGER NOT NULL,
  "start_date" TIMESTAMPTZ(3) NOT NULL,
  "end_date" TIMESTAMPTZ(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "archived_at" TIMESTAMPTZ(3),
  "last_generated_competence" VARCHAR(32),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "finance_fixed_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_fixed_accounts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "finance_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "finance_fixed_accounts_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "finance_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "finance_fixed_accounts_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "finance_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "finance_fixed_accounts_user_id_active_archived_at_idx" ON "finance_fixed_accounts"("user_id", "active", "archived_at");
CREATE INDEX "finance_fixed_accounts_user_id_last_generated_competence_idx" ON "finance_fixed_accounts"("user_id", "last_generated_competence");
CREATE INDEX "finance_fixed_accounts_category_id_idx" ON "finance_fixed_accounts"("category_id");

CREATE TABLE "finance_fixed_account_occurrences" (
  "id" UUID NOT NULL,
  "fixed_account_id" UUID NOT NULL,
  "competence_month" INTEGER NOT NULL,
  "competence_year" INTEGER NOT NULL,
  "reference_period" VARCHAR(32) NOT NULL,
  "due_date" TIMESTAMPTZ(3) NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" "TransactionType" NOT NULL,
  "category_id" UUID NOT NULL,
  "payment_method" "FixedAccountPaymentMethod" NOT NULL,
  "source_account_id" UUID,
  "destination_account_id" UUID,
  "amount" DECIMAL(12,2) NOT NULL,
  "status" "FixedAccountOccurrenceStatus" NOT NULL DEFAULT 'PENDING',
  "transaction_id" UUID,
  "paid_at" TIMESTAMPTZ(3),
  "reconciliation_status" "FixedAccountReconciliationStatus",
  "external_reference_id" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "finance_fixed_account_occurrences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_fixed_account_occurrences_fixed_account_id_fkey" FOREIGN KEY ("fixed_account_id") REFERENCES "finance_fixed_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "finance_fixed_account_occurrences_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "finance_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "finance_fixed_account_occurrences_source_account_id_fkey" FOREIGN KEY ("source_account_id") REFERENCES "finance_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "finance_fixed_account_occurrences_destination_account_id_fkey" FOREIGN KEY ("destination_account_id") REFERENCES "finance_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "finance_fixed_account_occurrences_fixed_account_id_reference_period_key" UNIQUE ("fixed_account_id", "reference_period")
);

CREATE INDEX "finance_fixed_account_occurrences_competence_year_competence_month_due_date_idx" ON "finance_fixed_account_occurrences"("competence_year", "competence_month", "due_date");
CREATE INDEX "finance_fixed_account_occurrences_status_due_date_idx" ON "finance_fixed_account_occurrences"("status", "due_date");

CREATE TABLE "finance_fixed_account_occurrence_payments" (
  "id" UUID NOT NULL,
  "occurrence_id" UUID NOT NULL,
  "transaction_id" UUID NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_fixed_account_occurrence_payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_fixed_account_occurrence_payments_transaction_id_key" UNIQUE ("transaction_id"),
  CONSTRAINT "finance_fixed_account_occurrence_payments_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "finance_fixed_account_occurrences"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "finance_fixed_account_occurrence_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "finance_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "finance_fixed_account_occurrence_payments_occurrence_id_idx" ON "finance_fixed_account_occurrence_payments"("occurrence_id");
