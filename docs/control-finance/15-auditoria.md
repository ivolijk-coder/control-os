# 15 — Auditoria

## Objetivo

Responder “quem fez o quê, quando, por qual canal e com qual resultado” sem expor informação sensível em logs.

## Responsabilidades, entidades e regras

`AuditEvent` contém `id`, `occurred_at`, `workspace_id`, `actor_type/id`, `action`, `resource_type/id`, `channel`, `request_id`, `before_hash`, `after_hash`, `outcome` e metadados redigidos. Eventos são append-only; retenção e acesso são definidos por plano/política. Não gravar senha, token, conteúdo completo de documento ou chave em auditoria.

## Fluxo e relações

Request/tool/webhook → autorização → domínio → transação de banco + audit event/outbox → worker de observabilidade. Financeiro, IA, admin, autenticação e exports usam o mesmo serviço. A UI oferece histórico compreensível e filtros por data/ação/ator.

## Boas práticas, riscos e expansão

Clock UTC, correlação, hashes, retenção, exportação e alertas de atividade anômala. Risco: log operacional não equivale a trilha de auditoria; hoje não há audit log transacional. Expansão: trilha inviolável/WORM, assinatura e relatórios de compliance.

