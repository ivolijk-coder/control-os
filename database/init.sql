-- CONTROL OS — schema inicial (Fase 1).
-- Espelha app/models/user.py. Alembic assume o controle de versão do schema
-- a partir da Fase 2; este arquivo cobre apenas o bootstrap local via Docker.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL DEFAULT 'Membro',
    company VARCHAR(255),
    plan VARCHAR(50) NOT NULL DEFAULT 'starter',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
