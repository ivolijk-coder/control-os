-- Preferências de apresentação do catálogo de categorias.
-- Migração exclusivamente aditiva: nenhuma categoria ou transação é alterada.

ALTER TABLE "finance_categories"
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "finance_categories_user_id_status_is_favorite_sort_order_idx"
  ON "finance_categories"("user_id", "status", "is_favorite", "sort_order");
