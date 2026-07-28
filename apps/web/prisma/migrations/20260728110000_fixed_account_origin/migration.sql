-- Classificação PF/PJ/Outros. A migration é aditiva e preserva o histórico.
CREATE TYPE "FixedAccountOrigin" AS ENUM ('PERSONAL', 'BUSINESS', 'OTHER');

ALTER TABLE "finance_fixed_accounts"
  ADD COLUMN "origin" "FixedAccountOrigin" NOT NULL DEFAULT 'PERSONAL';

ALTER TABLE "finance_fixed_account_occurrences"
  ADD COLUMN "origin" "FixedAccountOrigin" NOT NULL DEFAULT 'PERSONAL';
