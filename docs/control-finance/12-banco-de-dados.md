# 12 — Banco de Dados

## Objetivo

Garantir integridade, isolamento, recuperação e evolução previsível dos dados.

## Estado atual observado

PostgreSQL 16 em container na mesma VPS, persistido em volume Docker `controlos_postgres_data`; Prisma gerencia tabelas `finance_*` e `app_users`. FastAPI possui SQLAlchemy/Alembic, mas suas rotas são mock. Há risco de dois donos de migration no mesmo banco. Backups lógicos locais existem e foram verificados por checksum; ainda não há cópia externa nem restauração isolada comprovada.

## Arquitetura e regras aprovadas

- PostgreSQL gerenciado separado da VPS, privado, multi-AZ quando a escala justificar.
- Um schema/migration owner por banco de produto; recomendação: Alembic no backend FastAPI e Prisma como cliente gerado, sem Prisma Migrate em produção.
- Tabelas sempre incluem `id`, `workspace_id`, `created_at`, `updated_at`, e, quando aplicável, `created_by`, `version` e `deleted_at`.
- RLS por `workspace_id` como segunda linha de defesa, além da autorização na aplicação.
- Índices começam pelo escopo: `(workspace_id, occurred_at)`, `(workspace_id, status)`.

## Entidades, relações e fluxo

Organization → Membership → Workspace → módulos financeiros/conversas. `User` autentica, `Membership` autoriza, `Workspace` isola. Migrations passam por CI, revisão, backup e execução controlada; rollback de dado usa migration forward/reversal, não restauração cega.

## Boas práticas, riscos e expansão

PITR, backup diário externo, retenção e teste trimestral de restore são mandatórios. Risco crítico atual: perda total se VPS/volume falhar antes da cópia externa. Expansão: read replica, pooler PgBouncer, particionamento por data/workspace apenas com métrica real.

