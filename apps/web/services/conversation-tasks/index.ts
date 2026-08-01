/**
 * Ponto único de importação de `ConversationTask` — infraestrutura
 * genérica de interações proativas da NOVA (evolução "NOVA como centro da
 * experiência"). Produtores (Fase C) e consumidores (Fase D/E) importam
 * só daqui, nunca de `conversation-task.service`/`conversation-task.types`
 * diretamente.
 */
export * from './conversation-task.types';
export * from './conversation-task.service';
