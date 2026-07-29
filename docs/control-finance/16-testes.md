# 16 — Testes

## Objetivo

Garantir confiança para evoluir finanças e IA sem regressão silenciosa.

## Estado atual observado

Há testes TypeScript de FinanceService, Decision Engine, Action Engine e paridade do Channel Gateway. Não há evidência de suíte E2E, testes de contrato da FastAPI, carga, segurança, restauração completa ou testes de integração com provedores.

## Estratégia e responsabilidades

- **Unitários:** dinheiro, parcelas, ciclo de cartão, policies, prompts/tool validators.
- **Integração:** serviços + Postgres/Redis efêmeros, migrations e RLS.
- **Contrato:** OpenAPI/API webhooks/WhatsApp; consumidor e provedor.
- **E2E:** cadastro, workspace, lançamento, confirmação IA, visualização e logout em desktop/mobile.
- **Não funcionais:** carga, recuperação, segurança, acessibilidade e visual regression.

## Regras, fluxos, riscos e expansão

Todo bug financeiro ganha teste de regressão. CI: lint → typecheck → unit → integração → build → E2E crítico → scan. Dados de teste nunca são produção; testes de webhook usam sandbox. Risco: mocks passarem enquanto produção quebra. Expansão: chaos testing, testes de custo IA e canary releases.

