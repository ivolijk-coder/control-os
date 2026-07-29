# 02 — Navegação

## Objetivo

Permitir que o usuário chegue à conversa, à decisão ou ao detalhe financeiro em poucos toques, mantendo desktop e mobile coerentes.

## Responsabilidades e componentes

App Shell, sidebar desktop, topbar, navegação inferior mobile, seletor de agentes, busca global e estados vazios. Estrutura principal: **Visão geral**, **Financeiro** (transações, contas, contas fixas, cartões, parcelamentos, metas, relatórios), **Agentes** (NOVA/LEGENDARY), **Configurações**.

## Regras e fluxos

- A rota define contexto; o seletor de IA não deve alterar dados nem trocar conversa silenciosamente.
- Mobile mostra cinco destinos de maior frequência e menu para o restante; nunca corta conteúdo essencial atrás de barras fixas.
- Contexto financeiro deve preservar filtro de período/workspace ao navegar para detalhe.
- A conversa mantém painel de histórico com scroll interno e composer fixo, como produtos conversacionais maduros.

## Entidades, relações e expansão

`NavigationItem`, `WorkspaceContext`, `DateRange`, `AgentPersona`, `SavedView`. A navegação consome permissões e feature flags. Boas práticas: deep links, URLs estáveis, foco de teclado, safe areas, mínimo 44px para toque. Riscos: menu virar lista de módulos CONTROL OS sem hierarquia. Expansão: command palette, favoritos, atalhos por papel e visão de equipe.

