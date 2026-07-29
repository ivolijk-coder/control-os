# 13 — APIs

## Objetivo

Definir uma superfície estável, segura e previsível para web, mobile, WhatsApp e integrações futuras.

## Responsabilidades e padrão

FastAPI será a API canônica sob `/v1`. Next.js usa API apenas como BFF opcional de sessão/render; não duplica regra de domínio. Recursos seguem `/workspaces/{workspace_id}/transactions`, `/accounts`, `/recurring-bills`, `/cards`, `/goals`, `/agents` e `/webhooks`.

## Regras e fluxo

- OAuth/OIDC ou sessão segura → token/sessão → middleware resolve membership/workspace → policy autoriza → service executa → evento/auditoria retorna.
- POSTs externos recebem `Idempotency-Key`; erros seguem `application/problem+json` com `code`, `message`, `request_id` e detalhes seguros.
- Paginação cursor, filtros documentados, OpenAPI gerada, contratos de entrada/saída tipados e deprecação por versão.
- Webhooks verificam assinatura, registram evento primeiro e respondem rápido; worker processa depois.

## Entidades, relações, práticas, riscos e expansão

`ApiKey`, `AccessToken`, `IdempotencyRecord`, `WebhookEvent`, `RateLimitPolicy`. APIs usam módulos de domínio e auditoria. Risco atual: endpoints financeiros e IA no Next coexistem com FastAPI mock; não expor API pública antes da consolidação. Expansão: SDKs, webhooks de clientes, OpenAPI portal e APIs de parceiros.

