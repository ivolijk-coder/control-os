-- ConversationTask: infraestrutura genérica de interações proativas da
-- NOVA (evolução "NOVA como centro da experiência"). Documento analisado
-- (DOCUMENT_ANALYSIS_COMPLETED) é o primeiro produtor; tipos futuros
-- (email recebido, fatura vencida, PIX recebido, conta atrasada, viagem
-- próxima, meta atingida, evento de Open Finance) reaproveitam esta MESMA
-- tabela -- "type"/"source_type" são texto livre, validados em
-- TypeScript, para nunca exigir migration nova por tipo de evento.
--
-- Sem foreign key para (source_type, source_id): o mesmo par aponta para
-- tabelas diferentes dependendo do tipo de origem. Handlers de resolução
-- devem sempre buscar o registro de origem atual antes de agir -- nunca
-- decidir dinheiro só com base no "payload" congelado aqui.
--
-- idempotency_key é UNIQUE: garante que o mesmo evento de origem nunca
-- cria duas tasks (upsert na mesma transação que grava a origem). A
-- transição de status na resolução (PENDING/WAITING_USER -> IN_PROGRESS)
-- usa o mesmo padrão de "claim atômico" via updateMany já usado em
-- confirm/route.ts e DocumentAnalysisJob -- clique duplo, refresh ou
-- mensagem repetida nunca executam a ação duas vezes.
--
-- Aditiva: cria apenas tipos e tabela novos. Nenhum dado existente é
-- alterado.

CREATE TYPE "ConversationTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'WAITING_USER', 'COMPLETED', 'DISMISSED', 'FAILED');
CREATE TYPE "ConversationTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "conversation_tasks" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "status" "ConversationTaskStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "ConversationTaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "actions" JSONB NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "completed_at" TIMESTAMPTZ(3),
  "dismissed_at" TIMESTAMPTZ(3),
  CONSTRAINT "conversation_tasks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "conversation_tasks_idempotency_key_key" ON "conversation_tasks"("idempotency_key");
CREATE INDEX "conversation_tasks_user_id_status_idx" ON "conversation_tasks"("user_id", "status");
CREATE INDEX "conversation_tasks_source_type_source_id_idx" ON "conversation_tasks"("source_type", "source_id");

ALTER TABLE "conversation_tasks"
  ADD CONSTRAINT "conversation_tasks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
