# 04 — Financeiro

## Objetivo

Ser o núcleo confiável de dinheiro do cliente: saldo, receitas, despesas, transferências, compromissos e projeções.

## Responsabilidades

Manter livro-caixa por workspace, contas financeiras, categorias, saldos, transferências e relatórios. O módulo não conhece tela, WhatsApp ou modelo de IA; recebe comandos validados.

## Regras e fluxos

- Todo valor é `amount_cents: bigint` + `currency`; nunca `float`.
- Lançamento nasce `draft`, torna-se `posted` após confirmação e é corrigido por `reversal`, não por exclusão física.
- Transferência cria duas pernas atômicas, vinculadas pelo mesmo grupo; não altera patrimônio total.
- `user_id/workspace_id` é obrigatório em toda consulta e índice; API deriva escopo da sessão, nunca do payload.
- Criação via UI/IA/WhatsApp passa pelo mesmo Application Service e gera evento de auditoria.

## Entidades e componentes

`LedgerAccount`, `Transaction`, `TransactionLeg`, `Category`, `Transfer`, `Attachment`, `FinancialPeriod`; componentes Ledger, filtro de período, detalhe de transação, importação e confirmação de ação.

## Relações, boas práticas, riscos e expansão

Contas fixas, cartões e parcelamentos geram transações/obrigações; metas leem projeções. O schema atual possui `finance_transactions`, contas/categorias e transferências, mas usa decimal e permite delete físico: é base de migração, não ledger definitivo. Expansões: importação OFX/CSV, Open Finance, conciliação, múltiplas moedas e contador. Risco crítico: alterar histórico sem trilha prejudica confiança e suporte.

