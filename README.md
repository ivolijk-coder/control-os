# CONTROL OS — Monorepo

Operational Intelligence Platform. Este repositório contém a implementação real do produto, organizada em apps, packages e services.

## Status

**Fase 8 — Gateway Omnichannel (infraestrutura), WhatsApp ainda em modo mock.** Desde a Fase 7, o CONTROL OS ganhou uma camada explícita de entrada para qualquer canal de mensagens:

```
WhatsApp / Web Chat / (futuro: Telegram, e-mail, voz, API)
      ↓
Channel Gateway   (services/channel-gateway)
      ↓
CONTROL HUB → Context Provider → Memory Layer → Decision Engine →
Action Engine → Modules → Repositories → PostgreSQL
```

Nenhuma IA paralela foi criada: o Channel Gateway só decide QUAL adapter converte a mensagem nativa em `HubMessage` (`ChannelAdapter.toHubMessage`) e QUAL conversa ela pertence (`ConversationManager`), e então entrega ao MESMO `controlHub.receive(...)` que já processava o canal `api` desde a Fase 4 — o pipeline downstream (Decision Engine, Action Engine, Modules, Repositories) é idêntico para todos os canais, provado por teste (`services/channel-gateway/__tests__/channel-gateway.parity.test.ts`). Hoje só dois canais têm adapter registrado (`services/channel-gateway/index.ts`): Web Chat e WhatsApp — ambos MOCK (sem webhook/API externa real ainda; `sendMessage` grava num outbox em memória, inspecionável em teste). A migração do WhatsApp para uma API real (Evolution API/Meta Cloud/Twilio) e da UI web (`NovaWorkspace`) para passar pelo Gateway ficam para uma fase futura — só o lado de transporte muda quando isso acontecer, nada no Gateway ou no CONTROL HUB.

**Fase 7 — Financeiro completo, pronto para produção.** O monorepo evoluiu bastante desde a Fase 2 (abaixo, texto histórico da configuração inicial de deploy): a NOVA hoje conversa de verdade com um provedor real de IA (OpenAI, com fallback determinístico via `MockAIProvider`), o CONTROL HUB tem um Action Engine e Decision Engine reais, e o módulo Financeiro persiste de verdade em PostgreSQL via Prisma (contas, categorias, transferências, parcelamentos, recorrências, consultas — ver `services/modules/finance`, `services/repositories/finance`, `apps/web/prisma`).

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

**Causa raiz (histórica — ver atualização logo abaixo):** neste momento do projeto, o repositório ainda não possuía `pnpm-lock.yaml` (decisão deliberada, tomada para permitir push sem gerar o lockfile num ambiente sem acesso à rede). Sem lockfile, todo `pnpm install` precisa resolver o grafo de dependências do zero: buscar o metadata de cada pacote, direto e transitivo, das 7 packages do workspace, em paralelo, na registry do npm a cada build ("Scope: all 7 workspace projects" no log confirma isso). Esse volume alto de requisições HTTP concorrentes é o gatilho documentado de um bug de incompatibilidade entre o cliente de fetch do pnpm e o `fetch`/`URLSearchParams` nativos do Node.js — reportado de forma praticamente idêntica (mesmo texto de erro, mesmo padrão de log) na comunidade da própria Vercel. Não é causado por registry customizado, proxy, corepack, overrides/resolutions ou versão incompatível de pnpm/Node — a auditoria completa do repositório (abaixo) não encontrou nenhum desses itens.

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

**Atualização (Fase 7 — auditoria de produção):** a correção definitiva foi aplicada — `pnpm-lock.yaml` foi gerado e está commitado na raiz do monorepo, atualizado a cada dependência nova. Com lockfile, o pnpm lê o grafo já resolvido e baixa os tarballs diretamente, em vez de reresolver tudo do zero a cada build — a causa raiz do `ERR_INVALID_THIS`/`ERR_PNPM_META_FETCH_FAIL` está estruturalmente evitada. O `.npmrc` foi mantido como reforço de resiliência de rede (retries/concorrência), não porque ainda seja necessário para este bug específico.

## Persistência (Prisma + PostgreSQL)

`apps/web/prisma/schema.prisma` é o schema do módulo Financeiro (tabelas `finance_*`, mesmo Postgres de `apps/api`). Nada manual é necessário após `pnpm install`:

| Etapa | Quando roda | Comando |
|---|---|---|
| Gerar o Prisma Client | Automático, todo `pnpm install` (script `postinstall` em `apps/web/package.json`) | `prisma generate` |
| Aplicar migrations no banco | **Manual, uma vez por ambiente** (não faz parte do build) | `pnpm --filter @control-os/web db:deploy` |

`prisma generate` não precisa de conexão com o banco (só lê o schema), por isso nunca bloqueia `pnpm install`/`pnpm build` mesmo sem `DATABASE_URL` configurada. Já `prisma migrate deploy` precisa de uma `DATABASE_URL` real apontando para o Postgres de destino — isso é deploy de banco de dados, não deploy de aplicação, e por isso não está (de propósito) amarrado ao `buildCommand` da Vercel: rodar migration a cada build de aplicação é arriscado sem um passo de aprovação explícito. Configure `DATABASE_URL` nas variáveis de ambiente da Vercel (Project Settings → Environment Variables) e rode `db:deploy` manualmente (ou via uma pipeline de CI separada) sempre que uma nova migration for adicionada.

As migrations em `prisma/migrations/` foram escritas à mão (SQL padrão que `prisma migrate dev` geraria) porque o ambiente onde foram criadas não tinha acesso ao binário de engine do Prisma (`binaries.prisma.sh` bloqueado) — auditadas manualmente contra `schema.prisma` nesta fase, sem divergência encontrada. Recomendação: na primeira aplicação real contra um Postgres de verdade, rode `prisma migrate deploy` (não `dev`) para que o Prisma valide e registre o histórico de migrations sem tentar gerar SQL novo.

## Fases

- [x] **Fase 1** — Estrutura, configuração de stack, Design System, tema dark, 6 telas mockadas
- [x] **Fase 2** — Reorganização do monorepo (pnpm + Turborepo) para deploy na Vercel
- [x] **Fases 3–5** — NOVA Core (intents/planner/executor), integração real com OpenAI, CONTROL HUB (Action Engine + Decision Engine)
- [x] **Fase 6** — Persistência real (Prisma + PostgreSQL) para o módulo Financeiro
- [x] **Fase 7** — Financeiro completo (contas, categorias, transferências, parcelamentos, recorrências) + chat real ligado à persistência + auditoria de produção
- [x] **Fase 8** — Gateway Omnichannel: Channel Gateway, Channel Registry, Conversation Manager, adapters Web Chat + WhatsApp (mock) — infraestrutura pronta para conectar uma API real de WhatsApp (Evolution API/Meta Cloud/Twilio) numa fase futura (este documento)
