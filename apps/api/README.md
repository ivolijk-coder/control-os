# CONTROL OS API (apps/api)

FastAPI + SQLAlchemy + PostgreSQL. Fase 1: arquitetura completa, endpoints com dados mockados que espelham `apps/web/lib/mock-data.ts`.

## Estrutura

```
app/
  main.py              → instância FastAPI, CORS, health check
  core/
    config.py          → Settings (pydantic-settings, lê .env)
    security.py        → hashing de senha (bcrypt) + JWT
  api/v1/
    api.py             → agrega os routers
    endpoints/
      auth.py           → POST /api/v1/auth/login (mock)
      users.py          → GET  /api/v1/users/me (mock)
      dashboard.py       → GET  /api/v1/dashboard/summary (mock)
  models/               → SQLAlchemy ORM (User)
  schemas/              → Pydantic (contratos de request/response)
  db/
    base.py             → Base declarativa
    session.py          → engine + get_db() dependency
alembic/                → migrations (scaffold, sem migration real ainda)
```

## Rodando localmente

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

Docs interativas em `http://localhost:8000/docs`.

## Status da Fase 1

Todos os endpoints respondem com dados estáticos (mesmos dados mockados do frontend). `app/db/session.py` e `app/models/user.py` já existem e estão corretos, mas nenhuma rota os utiliza ainda — a conexão real ao PostgreSQL entra na Fase 2, junto com autenticação de verdade (o `create_access_token` já está implementado e pronto para uso).
