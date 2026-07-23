# CONTROL OS — apps/web — Dockerfile de produção (CONTROL OS Infra)
#
# Build de dois estágios (builder + runner). Contexto de build é a RAIZ do
# monorepo, não apps/web/ — obrigatório porque este é um workspace pnpm
# (apps/web depende de @control-os/ui|types|hooks|utils via "workspace:*",
# ver package.json) e o pnpm precisa enxergar packages/* para resolver
# esses links simbólicos durante o install. Ver infra/docker-compose.yml,
# serviço "web": build.context aponta para ".." (a raiz), build.dockerfile
# aponta para este arquivo.
#
# Decisão deliberada: este Dockerfile copia o monorepo INTEIRO antes de
# rodar "pnpm install" (em vez do padrão mais comum de copiar só os
# package.json primeiro, para cache de camada mais granular). Motivo:
# apps/web/package.json tem "postinstall": "prisma generate", que precisa
# de apps/web/prisma/schema.prisma presente no momento do install — copiar
# só manifests exigiria uma lista growing de exceções (prisma/, e
# qualquer outro arquivo que um postinstall futuro passe a exigir) para
# nunca quebrar silenciosamente. Correção > velocidade marginal de cache
# aqui. O .dockerignore na raiz do repositório (ver arquivo) já exclui
# node_modules/.git/.next de qualquer estágio, então o contexto enviado ao
# daemon do Docker continua pequeno.

FROM node:22-alpine AS builder

# libc6-compat — necessário para alguns pacotes nativos (ex.: sharp, usado
# transitivamente por next/image) rodarem corretamente no Alpine.
# openssl — necessário para o Prisma detectar e gerar o engine compatível
# com Alpine/OpenSSL 3, usado pelo repositório financeiro e pelo webhook.
RUN apk add --no-cache libc6-compat openssl

WORKDIR /repo

# Corepack já vem com o Node 22 — ativa a versão exata de pnpm que
# "packageManager" nos package.json deste repo já fixa (9.7.0), sem
# precisar instalar pnpm via npm.
RUN corepack enable && corepack prepare pnpm@9.7.0 --activate

COPY . .

RUN pnpm install --frozen-lockfile

# Variáveis NEXT_PUBLIC_* são incorporadas pelo Next.js no bundle do
# navegador durante o build. Recebê-las como build args impede que uma
# imagem compilada em modo mock continue usando mock depois de o container
# receber AI_PROVIDER=openai em runtime.
ARG NEXT_PUBLIC_AI_PROVIDER=mock
ARG NEXT_PUBLIC_AI_DEBUG_LOGS=0
ARG NEXT_PUBLIC_AI_FALLBACK_TO_MOCK=0
ENV NEXT_PUBLIC_AI_PROVIDER=${NEXT_PUBLIC_AI_PROVIDER}
ENV NEXT_PUBLIC_AI_DEBUG_LOGS=${NEXT_PUBLIC_AI_DEBUG_LOGS}
ENV NEXT_PUBLIC_AI_FALLBACK_TO_MOCK=${NEXT_PUBLIC_AI_FALLBACK_TO_MOCK}

ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm run build:web

# --- Runner ------------------------------------------------------------------
# Imagem final mínima: só o output "standalone" do Next.js (server.js +
# node_modules já podados para produção pelo próprio Next.js) + os
# arquivos estáticos + public/. Nada de pnpm, turbo, TypeScript ou
# devDependencies chega aqui — só o necessário para rodar "node server.js".
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# O Prisma Client incluído pelo output "standalone" precisa da biblioteca
# OpenSSL também em runtime; sem ela, qualquer rota que acessa dados falha.
RUN apk add --no-cache openssl

# Usuário não-root — princípio de menor privilégio, mesmo dentro do
# container (se o processo Next.js for comprometido, não roda como root).
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Estrutura do output "standalone" em monorepo: o Next.js espelha o
# caminho do app dentro do workspace (apps/web/) a partir da raiz do
# standalone — por isso os destinos abaixo repetem "apps/web/...".
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Healthcheck real (ver app/api/health/route.ts) — usado também pelo
# HEALTHCHECK declarado no docker-compose.yml; mantido aqui também para
# quem rodar esta imagem fora deste docker-compose (ex.: outro
# orquestrador).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
