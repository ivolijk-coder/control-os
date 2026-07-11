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
| pnpm | 9.7.0 | `packageManager` em `package.json` (raiz e `apps/web`) — a Vercel lê este campo (via Corepack) e ativa a versão certa do pnpm automaticamente |

Importante: `engines.pnpm` **não** é definido em nenhum `package.json`. Se existisse, o pnpm antigo que a Vercel usa internamente antes de trocar de versão (6.35.1) leria esse campo e travaria com `ERR_PNPM_UNSUPPORTED_ENGINE` antes mesmo do Corepack conseguir assumir. Só `packageManager` é seguro para pin de versão de pnpm neste fluxo; `engines.node` continua normal, pois não sofre desse problema.

`apps/api` (FastAPI) não faz parte deste deploy na Vercel — é uma aplicação Python separada, hospedada independentemente (Docker, Railway, Render, etc.), fora do escopo deste `vercel.json`.

Se você já criou o projeto na Vercel antes deste ajuste e configurou comandos manualmente na interface (Project Settings → Build & Development Settings), desative os toggles de "Override" desses campos para que os valores de `vercel.json` (e o comportamento padrão da Vercel, no caso do install) voltem a valer.

### Erro `ERR_PNPM_META_FETCH_FAIL` / `ERR_INVALID_THIS`

Depois da correção do `engines.pnpm`, surgiu um novo erro, já com o pnpm 9.7.0 correto rodando:

```
ERR_PNPM_META_FETCH_FAIL GET https://registry.npmjs.org/turbo
Value of "this" must be of type URLSearchParams
```

**Causa raiz:** este repositório não possui `pnpm-lock.yaml` (decisão deliberada, tomada para permitir push sem gerar o lockfile num ambiente sem acesso à rede). Sem lockfile, todo `pnpm install` precisa resolver o grafo de dependências do zero: buscar o metadata de cada pacote, direto e transitivo, das 7 packages do workspace, em paralelo, na registry do npm a cada build ("Scope: all 7 workspace projects" no log confirma isso). Esse volume alto de requisições HTTP concorrentes é o gatilho documentado de um bug de incompatibilidade entre o cliente de fetch do pnpm e o `fetch`/`URLSearchParams` nativos do Node.js — reportado de forma praticamente idêntica (mesmo texto de erro, mesmo padrão de log) na comunidade da própria Vercel. Não é causado por registry customizado, proxy, corepack, overrides/resolutions ou versão incompatível de pnpm/Node — a auditoria completa do repositório (abaixo) não encontrou nenhum desses itens.

**Auditoria realizada (resultado):**

| Item verificado | Resultado |
|---|---|
| `packageManager` em todos os `package.json` | presente e idêntico (`pnpm@9.7.0`) apenas na raiz e em `apps/web` — correto |
| `engines` em todos os `package.json` | apenas `node: 22.x` na raiz e em `apps/web`, sem `engines.pnpm` — correto |
| `pnpm-workspace.yaml` | aponta `apps/*` e `packages/*`, sem configuração de registry — correto |
| `pnpm-lock.yaml` | **ausente** — causa raiz identificada |
| `.npmrc` (raiz e subpastas) | **ausente** — nenhuma configuração de concorrência/retry de rede |
| `vercel.json` | sem `installCommand` (usa o padrão da Vercel), `buildCommand`/`outputDirectory` inalterados |
| `turbo.json` | sem qualquer referência a registry ou pnpm |
| Referências a Corepack | apenas menções em texto no README, nenhuma configuração ativa |
| Registry customizado | nenhuma ocorrência em todo o repositório |
| `overrides`/`resolutions` | nenhuma ocorrência em nenhum `package.json` |

**Correção aplicada:** adicionado `.npmrc` na raiz do monorepo reduzindo a concorrência de rede do pnpm (`network-concurrency=1`) e aumentando a tolerância a retries (`fetch-retries`, `fetch-retry-mintimeout`, `fetch-retry-maxtimeout`). Isso ataca diretamente o mecanismo que dispara o bug (muitas requisições HTTP simultâneas durante a resolução a frio), sem alterar versões, dependências ou arquitetura do projeto.

**Observação para o futuro:** a correção definitiva e mais robusta é gerar e commitar um `pnpm-lock.yaml` real (rodando `pnpm install` uma vez em uma máquina com acesso à rede). Com lockfile, o pnpm deixa de precisar resolver o grafo inteiro a cada build — ele lê o lockfile e baixa os tarballs diretamente, o que elimina a maior parte das requisições concorrentes de metadata e a exposição a esse bug. O `.npmrc` adicionado agora é a mitigação válida enquanto o projeto opera sem lockfile.

## Fases

- [x] **Fase 1** — Estrutura, configuração de stack, Design System, tema dark, 6 telas mockadas
- [x] **Fase 2** — Reorganização do monorepo (pnpm + Turborepo) para deploy na Vercel
- [ ] Fase 3 — (aguardando aprovação)
