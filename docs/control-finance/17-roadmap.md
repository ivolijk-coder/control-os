# 17 — Roadmap

## Objetivo

Evoluir sem trocar a fundação a cada estágio, com decisões guiadas por risco e carga medida.

## Fase 0 — Fundação antes de clientes

Consolidar backend canônico e migrations; mover PostgreSQL para serviço gerenciado; configurar backups diários externos/PITR e restore testado; S3 privado; worker/fila; observabilidade; auditoria; autenticação/isolamento por workspace; rotação de segredos. Meta inicial: **RPO ≤ 24 h, RTO ≤ 4 h**, reduzindo após estabilização.

## Capacidade estimada

| Escala | Plataforma mínima | Banco/dados | Operação |
| --- | --- | --- | --- |
| 100 usuários | Vercel; 1 VPS 2–4 vCPU/8 GB para API+worker; Redis gerenciado | Postgres gerenciado pequeno, PITR, S3 | Uptime, erros, backup diário externo e restore mensal |
| 1.000 usuários | 2 réplicas API, worker separado, CDN/WAF | Postgres 2–4 vCPU, pooler, Redis gerenciado | Sentry/OTel, alertas, CI/CD, RPO 1 h/RTO 2 h |
| 10.000 usuários | containers em ECS/Cloud Run/Kubernetes somente se necessário; autoscaling workers | Postgres HA, read replica, fila gerenciada, S3/CDN | tracing, load tests, DR testado, RPO 15 min/RTO 1 h |
| 100.000 usuários | serviços separados por domínio/carga comprovada, multi-região de leitura | Postgres multi-AZ/particionado, streaming/eventos, warehouse | SRE/on-call, DR regional, RPO/RTO por plano |

## Ordem de módulos

1. Identidade, workspace, segurança, banco, auditoria e operação.
2. Ledger/transações, contas, dashboard e relatórios.
3. Contas fixas, cartões, parcelamentos e metas.
4. NOVA operacional com confirmações; WhatsApp via outbox/worker.
5. LEGENDARY, documentos, Open Finance, equipes e ecossistema CONTROL OS.

## Riscos e critérios de avanço

Não avançar para aquisição paga enquanto não houver backup externo restaurado, isolamento testado, observabilidade e resposta a incidente. Cada fase exige ADR aprovado, métricas de erro/latência/custo e testes de regressão. Expansões futuras só entram com dono, contrato, modelo de dados e plano de reversão.

