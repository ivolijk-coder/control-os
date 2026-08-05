# Persistencia de conversas da NOVA

Esta fundacao armazena historico de conversa, nao memoria do usuario. Nenhuma
mensagem e promovida automaticamente a fato, preferencia ou contexto factual.

Politica inicial de retencao proposta:

- conversa ativa: mantida enquanto estiver ativa;
- conversa fechada: elegivel para remocao apos 180 dias;
- `deletedAt`: torna a conversa indisponivel imediatamente para leituras normais;
- purge fisico: sera implementado posteriormente, em fluxo autorizado e auditavel.

O PR9.1 apenas prepara os campos. Nao ha worker ou rotina de limpeza nesta fase.
