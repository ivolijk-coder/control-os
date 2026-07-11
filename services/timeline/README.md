# services/timeline — Timeline Inteligente / Control Feed™

Motor responsável por agregar, ordenar e priorizar os eventos que aparecem na Timeline Inteligente (Etapa 3): execuções da Nova, mudanças de missão, eventos financeiros, documentos, mensagens. Hoje, `apps/web/lib/mock-data.ts::MOCK_TIMELINE` e `apps/api/app/schemas` mostram apenas o formato de dados esperado.

**Status:** pasta reservada. Sem lógica implementada na Fase 1.

**Entra em fase futura:** ingestão de eventos reais dos demais serviços, priorização via Control Engine™, endpoints paginados para o componente `TimelineFeed` do frontend.
