# 07 — Contas Fixas

## Objetivo

Controlar obrigações recorrentes e seus vencimentos sem confundir a regra recorrente com o pagamento ocorrido.

## Responsabilidades, entidades e fluxo

`RecurringBill`, `BillOccurrence`, `Vendor`, `PaymentLink`, `ReminderPolicy`. Usuário cria a regra → worker materializa ocorrências futuras → dashboard alerta → usuário paga, adia ou cancela → ocorre transação vinculada. Cada ocorrência tem estado `open`, `paid`, `overdue`, `skipped` ou `cancelled`.

## Regras e relações

Regra é versionada; editar hoje não reescreve ocorrências passadas. Vencimento, timezone, valor estimado/real e conta de pagamento são explícitos. Relaciona-se a transações, cartões e projeção de fluxo. Boas práticas: idempotência do worker, janela de geração e alertas configuráveis. Riscos: gerar duas vezes a mesma conta ou atualizar histórico. Expansão: reajuste, rateio, boleto e compartilhamento familiar/equipe.

