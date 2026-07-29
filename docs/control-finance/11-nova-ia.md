# 11 — NOVA IA

## Objetivo

Fazer NOVA e LEGENDARY úteis, humanas e seguras: conversa contextual que vira ação rastreável, não um chat isolado.

## Responsabilidades

NOVA: captura, organiza, pergunta o que falta e executa o operacional. LEGENDARY: aconselha, sintetiza e desafia prioridades; não executa movimentações por padrão. O Agent Orchestrator monta contexto mínimo, chama modelo, valida ferramentas e envia resposta ao canal.

## Regras e fluxos

Mensagem → autenticação do canal → contexto permitido → classificação → proposta de ferramenta → validação → confirmação quando ação é financeira, destrutiva ou externa → execução idempotente → auditoria → resposta. Ações de baixo risco podem ser configuráveis; exclusões, pagamentos, transferências e mensagens proativas exigem confirmação explícita.

## Entidades e componentes

`Conversation`, `Message`, `AgentProfile`, `ToolCall`, `ToolExecution`, `Confirmation`, `MemoryFact`, `Consent`, `ChannelIdentity`. Componentes: feed com scroll interno, composer fixo, gravação/transcrição, escolha de voz, botão de interromper fala e cartão de confirmação.

## Relações, práticas, riscos e expansão

Agentes acessam módulos por ferramentas versionadas, nunca SQL/Prisma. Webhook WhatsApp atual já valida assinatura Meta e resolve número vinculado, mas processa/sinaliza resposta no request: deve ir para fila/outbox. Boas práticas: limites de contexto, PII mínima, logs redigidos, prompts versionados e fallback sem alucinar. Riscos: prompt injection, execução duplicada, voz/TTS indisponível e custo sem limites. Expansão: RAG de documentos consentidos, automações agendadas e múltiplos agentes especializados.

