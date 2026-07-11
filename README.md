# CONTROL OS — Monorepo

Operational Intelligence Platform. Este repositório contém a implementação real do produto, organizada em apps, packages e services.

## Status

**Fase 2 — Pronto para deploy na Vercel.** Monorepo reorganizado com pnpm workspaces + Turborepo, `apps/web` completo (public/, styles/, componentes) e `packages/config` com a configuração de TypeScript compartilhada. Nenhuma integração real de IA, banco de dados ou WhatsApp foi conectada ainda — isso é proposital, e faz parte do escopo das próximas fases.

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
    config/         → Configuração compartilhada (tsconfig.base.json)
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
  pnpm-workspace.yaml → Definição do workspace pnpm (apps/*, packages/*)
  turbo.json          → Pipelines do Turborepo (dev, build, lint, typecheck)
```

## Stack

- **Frontend:** Next.js, React, TypeScript, TailwindCSS, shadcn/ui, Framer Motion, Zustand, TanStack Query
- **Backend:** FastAPI (Python)
- **Banco de dados:** PostgreSQL (via SQLAlchemy + Alembic)
- **IA:** arquitetado para OpenAI, com camada de roteamento preparada para múltiplos modelos no futuro
- **Monorepo:** pnpm workspaces + Turborepo

## Rodando localmente

Este ambiente de geração de código não possui acesso à internet (sem `pnpm install` / `pip install` possível), então os arquivos foram escritos manualmente, prontos para instalação em uma máquina com acesso normal à rede.

```bash
# Instalar dependências de todo o monorepo (uma vez, na raiz)
pnpm install

# Frontend — a partir da raiz
pnpm dev
# ou, de dentro de apps/web
cd apps/web && pnpm dev

# Backend
cd apps/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Banco de dados
docker compose -f database/docker-compose.yml up -d
```

## Deploy na Vercel

O framework, o build command e o output directory são configurados automaticamente por `apps/web/vercel.json`. O install command **não é sobrescrito** — a Vercel usa o próprio install padrão dela, que já ativa a versão correta do pnpm sozinha a partir do campo `packageManager` do `package.json`. O único campo que precisa ser definido na tela de import é o **Root Directory**.

| Campo | Valor | Origem |
|---|---|---|
| Root Directory | `apps/web` | definido manualmente no import (único passo manual) |
| Framework Preset | Next.js | detectado via `apps/web/vercel.json` (`framework: "nextjs"`) |
| Install Command | padrão da Vercel (não sobrescrito) | — |
| Build Command | `cd ../.. && pnpm turbo run build --filter=./apps/web` | `apps/web/vercel.json` |
| Output Directory | `.next` | `apps/web/vercel.json` |
| Node.js | 22.x | `engines.node` em `package.json` (raiz e `apps/web`) |
| pnpm | 9.7.0 | `packageManager` em `package.json` (raiz e `apps/web`) — a Vercel lê este campo e ativa a versão certa do pnpm automaticamente via Corepack, sem precisar de install command customizado |

`apps/api` (FastAPI) não faz parte deste deploy na Vercel — é uma aplicação Python separada, hospedada independentemente (Docker, Railway, Render, etc.), fora do escopo deste `vercel.json`.

Se você já criou o projeto na Vercel antes deste ajuste e configurou comandos manualmente na interface (Project Settings → Build & Development Settings), desative os toggles de "Override" desses campos para que os valores de `vercel.json` (e o comportamento padrão da Vercel, no caso do install) voltem a valer.

## Fases

- [x] **Fase 1** — Estrutura, configuração de stack, Design System, tema dark, 6 telas mockadas
- [x] **Fase 2** — Reorganização do monorepo (pnpm + Turborepo) para deploy na Vercel
- [ ] Fase 3 — (aguardando aprovação)
