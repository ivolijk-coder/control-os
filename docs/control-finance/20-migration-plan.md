# 20 — Plano de Migração Progressiva

## Objetivo

Evoluir o CONTROL FINANCE sem reescrever o que funciona, sem duas fontes de verdade e com rollback seguro em cada etapa.

## Princípios

- Um domínio por vez; contrato, dono, testes de paridade e plano de reversão antes de tráfego real.
- Banco atual permanece a fonte de verdade até existir migração validada.
- Não mover lógica para FastAPI apenas por organização visual; mover quando houver ganho operacional, isolamento ou carga comprovados.
- Nunca executar dual-write sem idempotência, reconciliação e período curto/documentado.

## Fase A — fortalecer o núcleo atual

Manter Next.js/Prisma como aplicação principal. Centralizar regras financeiras em serviços de domínio, remover lógica de componentes/rotas, padronizar DTOs/erros, eliminar fallbacks de usuário, definir autorização por workspace e criar testes de paridade. Resultado: o domínio pode ser chamado por qualquer transporte futuro sem reescrever regras.

## Fase B — contratos e trabalho assíncrono

Definir OpenAPI/contratos estáveis. Introduzir worker/fila para tarefas realmente demoradas; primeiro com o mesmo banco e outbox. FastAPI pode assumir endpoints de integração/processamento, mantendo compatibilidade com a aplicação atual. Medir retries, latência, duplicidade e falhas antes de ampliar.

## Fase C — migração por domínio

| Ordem | Domínio | Motivo e condição de migração |
| --- | --- | --- |
| 1 | Notificações | Baixo acoplamento, naturalmente assíncrono; valida outbox/retry. |
| 2 | WhatsApp | Webhooks, deduplicação e envio devem sair do request; exige fila e observabilidade. |
| 3 | Documentos | Upload/processamento/antivírus usam S3 e worker; sem alterar financeiro. |
| 4 | NOVA | Orquestração, contexto e ferramentas; mantém confirmação e usa contratos dos domínios. |
| 5 | Relatórios | Leitura pesada/read models; ótima candidata para API/worker sem mutação crítica. |
| 6 | Contas fixas e metas | Regras recorrentes e projeções; migrar após jobs e auditoria maduros. |
| 7 | Cartões e parcelamentos | Exigem ciclos e consistência; migrar depois de paridade financeira comprovada. |
| 8 | Transações financeiras | Último domínio: somente com auditoria, transações, idempotência, testes e rollback validados. |

Para cada domínio: mapear endpoints e dados → testar em staging → executar shadow/read-only quando possível → canário por workspace → comparar resultados → ampliar → retirar caminho antigo somente após período estável.

## Fase D — tornar FastAPI canônica

Só ocorre após estabilidade operacional, testes de integração/contrato, métricas, observabilidade, desempenho, documentação de migrations, rollback ensaiado e nenhum acesso direto remanescente do Next.js ao banco para o domínio migrado. Next.js passa a frontend/BFF leve.

## Banco gerenciado e S3

Migrar PostgreSQL para gerenciado em projeto próprio: inventário, backup consistente, restore de ensaio, janela curta de escrita, validação de contagens/checksums e rollback documentado. Não usar dois bancos como verdade durante período indefinido. Introduzir S3 antes de receber arquivos de clientes; uploads assinados, bucket privado, metadados no banco e lifecycle/retention.

## Gatilhos objetivos e riscos

Migrar componentes quando demanda observada justificar: p95, erros, CPU/memória, jobs pendentes, RPM, tamanho/tempo de consulta do banco, volume de mensagens NOVA/WhatsApp e custo mensal. Riscos: divergência de dados, autorização diferente, migrations incompatíveis e perda de observabilidade. Mitigação: feature flags, canário, idempotência, reconciliação, backup/restauração e rollback testado para cada corte.
