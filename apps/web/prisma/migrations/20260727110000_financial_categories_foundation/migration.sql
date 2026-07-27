-- Categorias Financeiras: evolução aditiva. Nenhuma transação ou categoria
-- existente é removida; categorias legadas são materializadas e ligadas por FK.
CREATE TYPE "CategoryStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

ALTER TABLE "finance_categories"
  ADD COLUMN "icon" VARCHAR(40) NOT NULL DEFAULT 'tag',
  ADD COLUMN "color" VARCHAR(16) NOT NULL DEFAULT '#6366F1',
  ADD COLUMN "status" "CategoryStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "archived_at" TIMESTAMPTZ(3),
  ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Uma categoria persistida para cada rótulo legado, no mesmo usuário. A
-- categoria textual continua intacta como compatibilidade de leitura.
INSERT INTO "finance_categories" ("id", "user_id", "name", "kind", "icon", "color", "status", "created_at", "updated_at")
SELECT gen_random_uuid(), t."user_id", t."category",
       CASE WHEN bool_or(t."type" = 'INCOME') AND NOT bool_or(t."type" = 'EXPENSE') THEN 'INCOME'::"TransactionType"
            WHEN bool_or(t."type" = 'EXPENSE') AND NOT bool_or(t."type" = 'INCOME') THEN 'EXPENSE'::"TransactionType"
            ELSE NULL END,
       'tag', '#6366F1', 'ACTIVE', MIN(t."created_at"), CURRENT_TIMESTAMP
FROM "finance_transactions" t
WHERE t."category" IS NOT NULL AND t."category_id" IS NULL
GROUP BY t."user_id", t."category"
ON CONFLICT ("user_id", "name") DO NOTHING;

UPDATE "finance_transactions" t
SET "category_id" = c."id"
FROM "finance_categories" c
WHERE t."category_id" IS NULL
  AND t."user_id" = c."user_id"
  AND t."category" = c."name";

CREATE INDEX "finance_categories_user_id_status_idx" ON "finance_categories"("user_id", "status");
