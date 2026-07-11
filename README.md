# CONTROL OS — Monorepo

Operational Intelligence Platform. Este repositório contém a implementação real do produto, organizada em apps, packages e services.

## Status

**Fase 1 — Fundação.** Estrutura, configuração de stack e 6 telas/peças de interface com dados mockados (Login, Cadastro, Dashboard, Sidebar, Topbar, Layout Principal). Nenhuma integração real de IA, banco de dados ou WhatsApp foi conectada ainda — isso é proposital, e faz parte do escopo desta fase.

A documentação conceitual completa (Etapas 1 a 6 — Design System, Control Engine, Ecossistema, Arquitetura de Experiência, UX Blueprint, Blueprint de Produto, Control Core Cognitivo) permanece como a fonte de verdade de produto e vive fora deste repositório, nos documentos `.docx` já entregues.

## Estrutura

```
control-os/
  apps/
    web/          → Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Framer Motion
    api/           → FastAPI (Python) — arquitetura de backend
  packages/
    ui/            → Componentes de interface compartilhados (design system em código)
    types/         → Tipos TypeScript compartilhados entre apps
    hooks/         → Hooks React compartilhados
    utils/         → Funções utilitárias compartilhadas
  services/
    ai/            → Futuro: Control AI Router™ (roteamento entre modelos)
    auth/          → Futuro: autenticação e sessão (Control Core™)
    timeline/       → Futuro: Timeline Inteligente / Control Feed™
    mission/        → Futuro: motor de Missões™
    finance/        → Futuro: módulo financeiro
    whatsapp/       → Futuro: integração WhatsApp
    notifications/  → Futuro: Control Pulse™ (notificações e presença)
  database/         → Configuração PostgreSQL (docker-compose, schema inicial)
  docs/             → Notas de arquitetura específicas do código (não substitui os .docx)
```

## Stack

- **Frontend:** Next.js, React, TypeScript, TailwindCSS, shadcn/ui, Framer Motion, Zustand, TanStack Query
- **Backend:** FastAPI (Python)
- **Banco de dados:** PostgreSQL (via SQLAlchemy + Alembic)
- **IA:** arquitetado para OpenAI, com camada de roteamento preparada para múltiplos modelos no futuro

## Rodando localmente

Este ambiente de geração de código não possui acesso à internet (sem `npm install` / `pip install` possível), então os arquivos foram escritos manualmente, prontos para instalação em uma máquina com acesso normal à rede.

```bash
# Frontend
cd apps/web
npm install
npm run dev

# Backend
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Banco de dados
docker compose -f database/docker-compose.yml up -d
```

## Fases

- [x] **Fase 1** — Estrutura, configuração de stack, Design System, tema dark, 6 telas mockadas
- [ ] Fase 2 — (aguardando aprovação)
