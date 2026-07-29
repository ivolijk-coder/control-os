# 06 — Transações

## Objetivo

Oferecer registro, consulta, correção e evidência de cada movimentação com precisão financeira.

## Responsabilidades e entidades

`Transaction`, `TransactionLeg`, `TransactionSource`, `Category`, `Attachment`, `Reversal`, `IdempotencyKey`. Componentes: lista virtualizada, filtros, detalhe, formulário rápido, comprovante e modal de reversão.

## Regras e fluxos

Entrada manual/IA/importação → validação → deduplicação por chave → preview → postagem → auditoria. Edição de valor/data/conta cria versão ou reversão conforme impacto; exclusão vira arquivamento/reversão. Origem, autor, canal e data efetiva são obrigatórios. Anexo fica em S3 privado, com hash e metadados no banco.

## Relações, boas práticas, riscos e expansão

Transações alimentam dashboards, cartões, parcelamentos, metas e relatórios. Paginação cursor-based, filtros por data/conta/categoria/status, autorização por workspace e idempotência em cada POST. Riscos: duplicação por webhook/retry e campos de origem sem padronização. Expansão: aprovação em equipe, conciliação, importação e regras automáticas.

