-- CONTROL OS — vínculo seguro entre conta e WhatsApp.
-- O WhatsApp só passa a apontar para uma conta depois de a própria pessoa
-- enviar o código de confirmação a partir daquele número.

CREATE TABLE "app_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_users_email_key" ON "app_users"("email");

CREATE TABLE "whatsapp_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_links_phone_e164_key" ON "whatsapp_links"("phone_e164");
CREATE INDEX "whatsapp_links_user_id_idx" ON "whatsapp_links"("user_id");
ALTER TABLE "whatsapp_links" ADD CONSTRAINT "whatsapp_links_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "whatsapp_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "whatsapp_verifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_verifications_phone_e164_key" ON "whatsapp_verifications"("phone_e164");
CREATE INDEX "whatsapp_verifications_user_id_idx" ON "whatsapp_verifications"("user_id");
ALTER TABLE "whatsapp_verifications" ADD CONSTRAINT "whatsapp_verifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "app_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
