# 08 — Cartões

## Objetivo

Representar crédito como obrigação futura, com fechamento, vencimento, limite e fatura — não como conta corrente comum.

## Responsabilidades e entidades

`CreditCard`, `CardCycle`, `CardPurchase`, `Statement`, `StatementPayment`, `CreditLimit`. Componentes: resumo de limite, fatura atual, lançamentos, calendário de fechamento e pagamento.

## Regras e fluxo

Compra entra na fatura do ciclo correto; pagamento cria transferência/saída da conta pagadora para reduzir a obrigação. Parcelas de cartão entram em ciclos futuros. Fechamento e vencimento são timezone-aware. Nenhuma compra é contabilizada duas vezes como despesa e fatura.

## Relações, práticas, riscos e expansão

Cartão integra Transações, Parcelamentos, Contas Fixas e Dashboard. Boas práticas: modelo explícito de fatura e testes de borda no dia de fechamento. Riscos: saldo disponível errado e parcelamento duplicado. Expansão: cartões adicionais, importação de fatura, alertas de limite e conciliação Open Finance.

