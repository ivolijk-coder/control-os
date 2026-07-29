# CONTROL FINANCE — Arquitetura de Produto

**Status:** proposta para aprovação.  
**Regra:** estes documentos são a fonte de verdade antes de qualquer novo módulo ou tela. Divergências exigem uma decisão arquitetural registrada.

## Estado da análise

O repositório atual é um monorepo TypeScript/Python. O produto em execução usa Next.js 14 como interface e também como BFF (Route Handlers), Prisma/PostgreSQL para o núcleo financeiro, Traefik/Docker Compose na VPS e uma FastAPI estrutural ainda não utilizada como backend canônico. A integração oficial com WhatsApp Cloud API entra pelo Next.js; Redis e Evolution API existem na infraestrutura, mas não há worker de aplicação nem fila de tarefas em uso.

## Índice

| Documento | Decisão principal |
| --- | --- |
| [00 — Visão do Produto](00-visao-do-produto.md) | CONTROL FINANCE é um SaaS premium, IA-primeiro, pertencente ao ecossistema CONTROL OS. |
| [01 — Arquitetura Geral](01-arquitetura-geral.md) | Backend canônico será FastAPI modular; Next será frontend/BFF leve. |
| [02 — Navegação](02-navegacao.md) | IA no centro e financeiro organizado por tarefas, não por telas soltas. |
| [03 — Design System](03-design-system.md) | Tokens, componentes e acessibilidade antes de componentes novos. |
| [04 — Financeiro](04-financeiro.md) | Livro-caixa auditável, valores em centavos, lançamentos imutáveis. |
| [05 — Dashboard](05-dashboard.md) | Painel de decisão, não planilha; read models e métricas claras. |
| [06 — Transações](06-transacoes.md) | Ciclo de vida draft/posted/reversed, idempotência e reconciliação. |
| [07 — Contas Fixas](07-contas-fixas.md) | Regras recorrentes geram ocorrências rastreáveis. |
| [08 — Cartões](08-cartoes.md) | Faturas, ciclos e limites separados do dinheiro disponível. |
| [09 — Parcelamentos](09-parcelamentos.md) | Contrato pai e parcelas filhas, nunca duplicação informal. |
| [10 — Metas](10-metas.md) | Metas mensuráveis ligadas a plano e projeção. |
| [11 — NOVA IA](11-nova-ia.md) | IA com ferramentas permitidas, confirmações e memória consentida. |
| [12 — Banco de Dados](12-banco-de-dados.md) | PostgreSQL gerenciado, isolamento por usuário/tenant e migrations únicas. |
| [13 — APIs](13-apis.md) | REST versionada, contratos tipados, erro/idempotência padronizados. |
| [14 — Segurança](14-seguranca.md) | Defesa em profundidade, segredos fora do código e isolamento obrigatório. |
| [15 — Auditoria](15-auditoria.md) | Eventos imutáveis para toda ação relevante. |
| [16 — Testes](16-testes.md) | Pirâmide de testes, contratos e recuperação de desastre testada. |
| [17 — Roadmap](17-roadmap.md) | Evolução mensurável para 100 a 100.000 usuários. |
| [18 — Architecture Decision Record](18-architecture-decision-record.md) | Decisão provisória: lançamento seguro sem reescrita prematura. |
| [19 — Arquitetura de Lançamento](19-launch-architecture.md) | Configuração mínima, segura e operável para os primeiros clientes. |
| [20 — Plano de Migração](20-migration-plan.md) | Evolução progressiva para FastAPI, banco gerenciado, worker e S3. |
| [24 — Domínio Financeiro](24-financial-domain.md) | Fonte oficial das regras de negócio do dinheiro. |

## Princípios não negociáveis

1. Nenhum dado financeiro é lido ou alterado sem escopo de proprietário no servidor.
2. Dinheiro é tratado como inteiro em centavos e moeda ISO 4217; nunca `float`.
3. Ações financeiras relevantes são auditáveis, idempotentes e reversíveis — não “apagadas” sem rastro.
4. Um único dono de migrations e um único backend canônico por domínio.
5. Banco, backups e arquivos de clientes sobrevivem à perda de uma VPS.
6. IA sugere e executa apenas dentro de permissões explícitas; ações sensíveis pedem confirmação.
7. Observabilidade e restauração são requisitos de produto, não tarefas posteriores.

## Porta de decisão

Esta documentação descreve uma **arquitetura-alvo**, mas não autoriza uma reescrita. A decisão vigente está no [ADR 18](18-architecture-decision-record.md): preservar o núcleo funcional Next.js/Prisma e priorizar P0 de segurança, persistência, isolamento e recuperação antes de qualquer migração estrutural.
