# 05 — Dashboard

## Objetivo

Transformar dados em decisões: o que requer atenção, o que mudou e qual é a próxima ação.

## Responsabilidades, regras e fluxo

O dashboard não é origem de dados. Ele lê um `DashboardReadModel` por workspace/período, prioriza no máximo três alertas e liga cada cartão a uma tela de detalhe. Fluxo: selecionar período → carregar resumo/cache → mostrar exceções → navegar/agir. Sempre exibir timestamp de atualização e estados vazios honestos.

## Entidades e componentes

`DashboardSnapshot`, `CashFlowProjection`, `AttentionItem`, `Metric`, `DateRange`. Componentes: hero conversacional, atenção agora, resumo financeiro, gráfico de fluxo, ações rápidas e cards responsivos.

## Relações, boas práticas, riscos e expansão

Consome Financeiro, Metas, Contas Fixas e Agentes; não escreve diretamente em nenhum deles. Agregações pesadas devem usar consultas indexadas/cache e, no futuro, read models atualizados por worker. Riscos: números inconsistentes por filtros diferentes e dashboard cheio de tabelas. Expansão: visão empresarial, comparação mensal, customização e digest semanal.

