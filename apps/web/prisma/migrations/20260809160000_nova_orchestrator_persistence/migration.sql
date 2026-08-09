-- PR10.2: additive persistence foundation for the server-side NOVA orchestrator.
-- No existing rows or tables are rewritten.
CREATE TYPE "NovaTurnStatus" AS ENUM (
  'RECEIVED',
  'PROCESSING',
  'AWAITING_CONFIRMATION',
  'EXECUTING',
  'COMPLETED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "NovaPendingConfirmationStatus" AS ENUM (
  'PENDING',
  'CLAIMED',
  'CONFIRMED',
  'CANCELLED',
  'EXPIRED',
  'FAILED'
);

CREATE TABLE "nova_turns" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "client_turn_id" VARCHAR(160) NOT NULL,
  "status" "NovaTurnStatus" NOT NULL DEFAULT 'RECEIVED',
  "intent_family" VARCHAR(120),
  "focus_category" VARCHAR(120),
  "provider" VARCHAR(80),
  "provider_response_id" VARCHAR(255),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "processing_owner" VARCHAR(160),
  "processing_lease_token" VARCHAR(160),
  "processing_lease_until" TIMESTAMPTZ(3),
  "last_error_code" VARCHAR(120),
  "started_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  "failed_at" TIMESTAMPTZ(3),
  "cancelled_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "nova_turns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nova_pending_confirmations" (
  "id" UUID NOT NULL,
  "turn_id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "action_kind" VARCHAR(120) NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "validated_payload" JSONB NOT NULL,
  "status" "NovaPendingConfirmationStatus" NOT NULL DEFAULT 'PENDING',
  "version" INTEGER NOT NULL DEFAULT 1,
  "claim_owner" VARCHAR(160),
  "claim_lease_token" VARCHAR(160),
  "claim_lease_until" TIMESTAMPTZ(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "confirmed_at" TIMESTAMPTZ(3),
  "cancelled_at" TIMESTAMPTZ(3),
  "expired_at" TIMESTAMPTZ(3),
  "failed_at" TIMESTAMPTZ(3),
  "last_error_code" VARCHAR(120),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "nova_pending_confirmations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "nova_conversation_states" (
  "conversation_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "intent_family" VARCHAR(120) NOT NULL,
  "focus_category" VARCHAR(120),
  "focus_type" VARCHAR(120),
  "focus_reference" JSONB,
  "source_turn_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "nova_conversation_states_pkey" PRIMARY KEY ("conversation_id")
);

CREATE UNIQUE INDEX "nova_turns_conversation_id_client_turn_id_key"
  ON "nova_turns"("conversation_id", "client_turn_id");
CREATE UNIQUE INDEX "nova_turns_id_conversation_id_user_id_key"
  ON "nova_turns"("id", "conversation_id", "user_id");
CREATE INDEX "nova_turns_conversation_id_created_at_idx"
  ON "nova_turns"("conversation_id", "created_at");
CREATE INDEX "nova_turns_user_id_created_at_idx"
  ON "nova_turns"("user_id", "created_at");
CREATE INDEX "nova_turns_status_processing_lease_until_idx"
  ON "nova_turns"("status", "processing_lease_until");
CREATE INDEX "nova_turns_user_id_status_updated_at_idx"
  ON "nova_turns"("user_id", "status", "updated_at");

CREATE UNIQUE INDEX "nova_pending_confirmations_turn_id_key"
  ON "nova_pending_confirmations"("turn_id");
CREATE UNIQUE INDEX "nova_pending_confirmations_id_turn_id_conversation_id_user_id_key"
  ON "nova_pending_confirmations"("id", "turn_id", "conversation_id", "user_id");
CREATE INDEX "nova_pending_confirmations_user_id_status_expires_at_idx"
  ON "nova_pending_confirmations"("user_id", "status", "expires_at");
CREATE INDEX "nova_pending_confirmations_status_claim_lease_until_idx"
  ON "nova_pending_confirmations"("status", "claim_lease_until");
CREATE INDEX "nova_pending_confirmations_conversation_id_created_at_idx"
  ON "nova_pending_confirmations"("conversation_id", "created_at");

CREATE UNIQUE INDEX "nova_conversation_states_conversation_id_user_id_key"
  ON "nova_conversation_states"("conversation_id", "user_id");
CREATE INDEX "nova_conversation_states_expires_at_idx"
  ON "nova_conversation_states"("expires_at");

ALTER TABLE "nova_turns"
  ADD CONSTRAINT "nova_turns_conversation_id_user_id_fkey"
  FOREIGN KEY ("conversation_id", "user_id")
  REFERENCES "nova_conversations"("id", "user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nova_pending_confirmations"
  ADD CONSTRAINT "nova_pending_confirmations_turn_id_conversation_id_user_id_fkey"
  FOREIGN KEY ("turn_id", "conversation_id", "user_id")
  REFERENCES "nova_turns"("id", "conversation_id", "user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nova_conversation_states"
  ADD CONSTRAINT "nova_conversation_states_conversation_id_user_id_fkey"
  FOREIGN KEY ("conversation_id", "user_id")
  REFERENCES "nova_conversations"("id", "user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "nova_conversation_states"
  ADD CONSTRAINT "nova_conversation_states_source_turn_id_conversation_id_user_id_fkey"
  FOREIGN KEY ("source_turn_id", "conversation_id", "user_id")
  REFERENCES "nova_turns"("id", "conversation_id", "user_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
