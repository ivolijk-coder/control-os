# 18 — Architecture Decision Record: lançamento seguro e evolução progressiva

**Status:** aceito provisoriamente para planejamento; requer revisão antes de migrações estruturais.  
**Decisão:** ADR-CF-001.

## Contexto

O CONTROL FINANCE está em validação comercial. O núcleo financeiro que funciona está no Next.js com Prisma e PostgreSQL na VPS; a FastAPI ainda não é o backend canônico. Há Docker, volumes persistentes e backup local, mas não há cópia externa validada, restauração real comprovada, worker ou fila de aplicação.

O risco maior neste estágio não é falta de microserviços: é perder dados, permitir acesso cruzado ou travar o produto com uma reescrita prematura.

## Arquitetura atual

- **Next.js + Prisma:** interface, autenticação, regras financeiras, APIs internas, IA e parte dos webhooks.
- **PostgreSQL e Redis na VPS:** volumes Docker persistentes; banco é a fonte atual dos dados financeiros.
- **VPS:** Traefik, Next.js, FastAPI estrutural, Redis e integração WhatsApp/Evolution.
- **Backup:** dump lógico local verificado por integridade; sem offsite e sem restore isolado testado.

## Arquitetura-alvo

Vercel para o frontend; FastAPI modular como API canônica; worker e fila para tarefas assíncronas; PostgreSQL gerenciado isolado; Redis gerenciado quando justificado; S3 privado para documentos; monitoramento, logs e recuperação de desastre testados.

## Decisão provisória

1. Não reescrever o núcleo Next.js/Prisma agora.
2. Não substituir o banco imediatamente se persistência, segurança, backup externo e restore forem comprovados.
3. Não criar microserviços; manter monólito modular com contratos de domínio.
4. Priorizar P0: isolamento, autorização, integridade financeira, segredos, HTTPS, backup/restauração, logs e migrações.
5. Desenvolver FastAPI progressivamente por domínio, começando por integrações ou trabalho assíncrono, sem cortar o produto em funcionamento.

## Alternativas consideradas

| Alternativa | Decisão | Motivo |
| --- | --- | --- |
| Reescrever tudo em FastAPI agora | Rejeitada | Alto risco, longo tempo sem valor comercial e difícil validação de paridade. |
| Manter tudo indefinidamente no Next.js | Rejeitada | Limita jobs persistentes, integrações e operação em escala. |
| Microsserviços desde o início | Rejeitada | Custo operacional e complexidade sem evidência de carga. |
| Evolução por domínio, com monólito modular | Escolhida | Preserva o que funciona, reduz risco e mantém uma rota clara para escala. |

## Consequências e riscos

Benefícios: lançamento mais rápido, menos regressão e decisões guiadas por métricas. Consequência: por algum tempo haverá FastAPI e Next.js coexistindo; cada domínio precisa ter um dono claro e não pode haver duas fontes de verdade. Risco atual crítico: backup só local, ausência de restore testado e possíveis lacunas de isolamento/autorização devem ser eliminados antes de clientes reais.

## Critérios de revisão

Revisar este ADR quando houver um dos seguintes sinais, por período sustentado e não por número bruto de cadastros:

- p95 de API acima de 500 ms ou erros acima de 1% sem causa simples;
- CPU acima de 70% ou memória acima de 75% de forma recorrente;
- filas/tarefas longas bloqueando requisições de usuários;
- mais de 100 jobs pendentes ou retries manuais recorrentes;
- aumento de mensagens NOVA/WhatsApp exigindo processamento assíncrono;
- consultas críticas acima de 200 ms, banco acima de 50 GB ou conexão saturada;
- custo/indisponibilidade da VPS incompatível com RPO/RTO prometidos;
- necessidade comprovada de múltiplas réplicas da aplicação.

Qualquer revisão exige ADR novo, plano de rollback, métrica-base e aprovação explícita.
