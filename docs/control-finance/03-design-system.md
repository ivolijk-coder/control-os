# 03 — Design System

## Objetivo

Construir uma linguagem premium, reconhecível e acessível, sem CSS duplicado nem telas visualmente divergentes.

## Estado atual e direção

Já existem Tailwind, Radix/shadcn, tokens CSS, componentes compartilhados em `packages/ui`, tema escuro e preferência clara. A identidade aprovada é escura, com marca azul/violeta da NOVA e dourado/laranja da LEGENDARY; o tema claro preserva navegação escura. A versão clara precisa ser tratada como tema completo, não como inversão de cores.

## Responsabilidades

Tokens: cor, tipografia, espaçamento, raio, sombra, movimento e z-index. Componentes: botão, campo, card, tabela, badge, modal, toast, empty state, navegação, conversa e calendário. Padrões: loading, erro, confirmação destrutiva, responsividade e estados de foco.

## Regras, fluxos e entidades

- Sem cor literal fora de tokens sem exceção documentada.
- NOVA e LEGENDARY usam marcas/personas; não substituem ícones funcionais.
- Toda ação possui estado normal, hover, foco, loading, sucesso, erro e desabilitado.
- Tema é preferência por usuário, aplicada antes da primeira pintura para evitar flash.

`ThemePreference`, `PersonaBrand`, `DesignToken`, `ComponentVariant`. O sistema serve Dashboard, Financeiro e IA. Boas práticas: WCAG AA, contraste, redução de movimento, componentes compostos e testes visuais. Riscos: uso excessivo de glow, superfícies pretas explícitas quebrando o claro e iconografia decorativa ambígua. Expansão: tokens de marca por organização e biblioteca documentada/Storybook.

