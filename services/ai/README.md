# services/ai — Control AI Router™

Camada de roteamento entre modelos de IA (OpenAI hoje; arquitetada para suportar múltiplos provedores no futuro, conforme Etapa 2.1). Responsável por decidir qual modelo/estratégia atende cada tipo de raciocínio da Nova™ (conversas, classificação, planejamento, geração de conteúdo).

**Status:** pasta reservada. Nenhum código implementado na Fase 1 — `OPENAI_API_KEY` existe em `apps/api/.env.example` mas não é usada por nenhuma rota ainda.

**Entra em fase futura:** integração real com OpenAI, lógica de roteamento entre modelos, e conexão com os motores cognitivos descritos na Etapa 6 (CONTROL CORE™).
