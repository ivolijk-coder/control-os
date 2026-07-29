# 09 — Parcelamentos

## Objetivo

Mostrar o compromisso total e seu impacto futuro sem transformar cada parcela em registro desconexo.

## Responsabilidades, entidades e fluxo

`InstallmentPlan`, `Installment`, `Purchase`, `Schedule`. Usuário informa valor total, número de parcelas e início → serviço calcula centavos sem perda → cria plano pai e filhos agendados → cada parcela é postada conforme data/ciclo.

## Regras

Soma das parcelas deve igualar total em centavos; último item absorve resto. Plano tem estado ativo/concluído/cancelado; cancelamento preserva pagamentos passados e replaneja apenas futuro. Nunca se usa texto “3/12” como única fonte de verdade.

## Relações, práticas, riscos e expansão

Pode pertencer a cartão, conta ou contrato; alimenta previsão de caixa e metas. Boas práticas: criação atômica, IDs de grupo, indicadores de progresso. Riscos: timezone e dia inexistente em meses curtos. Expansão: juros, renegociação, antecipação e contratos de empréstimo.

