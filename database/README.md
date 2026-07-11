# CONTROL OS — Database

PostgreSQL 16 via Docker Compose.

```bash
docker compose -f database/docker-compose.yml up -d
```

Sobe um container `control-os-postgres` na porta `5432`, com as credenciais definidas em `apps/api/.env.example`, e aplica `init.sql` no primeiro start.

A partir da Fase 2, migrations reais passam a ser controladas via Alembic (`apps/api/alembic`), e `init.sql` deixa de ser a fonte de verdade do schema.
