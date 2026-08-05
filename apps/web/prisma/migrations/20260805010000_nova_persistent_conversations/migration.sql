-- CreateEnum
CREATE TYPE "NovaConversationChannel" AS ENUM ('WEB', 'APP', 'WHATSAPP', 'API');

-- CreateEnum
CREATE TYPE "NovaConversationPersona" AS ENUM ('NOVA', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "NovaConversationStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NovaMessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "nova_conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "channel" "NovaConversationChannel" NOT NULL,
    "persona" "NovaConversationPersona" NOT NULL,
    "status" "NovaConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "active_key" TEXT,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "nova_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nova_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "NovaMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "intent" TEXT,
    "provider" TEXT,
    "provider_response_id" TEXT,
    "correlation_id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "redacted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nova_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "nova_conversations_active_key_key" ON "nova_conversations"("active_key");
CREATE UNIQUE INDEX "nova_conversations_id_user_id_key" ON "nova_conversations"("id", "user_id");
CREATE INDEX "nova_conversations_user_id_status_last_message_at_idx" ON "nova_conversations"("user_id", "status", "last_message_at");
CREATE INDEX "nova_conversations_user_id_channel_persona_last_message_at_idx" ON "nova_conversations"("user_id", "channel", "persona", "last_message_at");
CREATE UNIQUE INDEX "nova_messages_conversation_id_correlation_id_role_key" ON "nova_messages"("conversation_id", "correlation_id", "role");
CREATE INDEX "nova_messages_conversation_id_sequence_idx" ON "nova_messages"("conversation_id", "sequence");
CREATE INDEX "nova_messages_user_id_created_at_idx" ON "nova_messages"("user_id", "created_at");
CREATE INDEX "nova_messages_provider_response_id_idx" ON "nova_messages"("provider_response_id");

-- AddForeignKey
ALTER TABLE "nova_conversations" ADD CONSTRAINT "nova_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nova_messages" ADD CONSTRAINT "nova_messages_conversation_id_user_id_fkey" FOREIGN KEY ("conversation_id", "user_id") REFERENCES "nova_conversations"("id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE;
