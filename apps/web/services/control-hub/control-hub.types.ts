import type { ActionResult } from './action-engine.types';

/**
 * CONTROL HUB — modelo universal de mensagem.
 *
 * Núcleo da nova arquitetura de comunicação do CONTROL OS: "qualquer
 * interação do usuário passa primeiro por um núcleo central antes de
 * chegar à NOVA". Todo canal (WhatsApp, app, web, API pública e, no
 * futuro, Telegram/e-mail/voz) obrigatoriamente converte sua mensagem
 * nativa para este formato antes de entregá-la ao `ControlHub` — nenhum
 * canal fala com a NOVA (ou com qualquer camada interna) diretamente.
 *
 * Vive em `services/control-hub/`, não em `@control-os/types`: os tipos
 * de domínio compartilhados nesse pacote (`Mission`, `Debt`, `AgendaEvent`
 * etc.) espelham contratos que também existirão em `apps/api/app/schemas`
 * quando o backend real chegar — são "o quê" o produto guarda. `HubMessage`
 * é um contrato de transporte/infraestrutura ("como" uma interação chega
 * até o sistema), uma categoria diferente; por isso fica junto do módulo
 * que o consome.
 */

/**
 * Canais suportados nesta fase — exatamente os 4 adapters criados em
 * `channels/` (ver `apps/web/channels/`). Novos canais (Telegram, e-mail,
 * voz, Slack, Discord...) entram aqui SÓ quando o adapter correspondente
 * for criado — nunca antes, para este union nunca ter um membro "morto"
 * que nenhum adapter real produz.
 */
export type HubChannel = 'whatsapp' | 'app' | 'web' | 'api';

/** Tipo de conteúdo de uma mensagem — cobre os formatos que os canais poderão enviar no futuro (áudio/imagem/documento ainda não são processados nesta fase, só tipados). */
export type HubMessageType = 'text' | 'audio' | 'image' | 'document' | 'event';

/**
 * Anexo de uma `HubMessage` (áudio, imagem, documento). Só a forma dos
 * dados — nenhum processamento (download, transcrição, OCR) existe nesta
 * fase; ver seção "IMPORTANTE" do pedido original: OCR/áudio/imagem ficam
 * para uma fase futura.
 */
export interface Attachment {
  id: string;
  type: Extract<HubMessageType, 'audio' | 'image' | 'document'>;
  /** URL de origem do anexo no canal nativo (ex.: link de mídia do WhatsApp). Opcional — nem todo canal expõe uma URL direta. */
  url?: string;
  mimeType?: string;
  fileName?: string;
  sizeBytes?: number;
}

/**
 * Envelope universal — todo canal DEVE produzir exatamente este formato
 * antes de chamar `ControlHub.receive`. Único ponto de entrada de
 * qualquer informação no CONTROL OS (ver `control-hub.interfaces.ts`).
 *
 * Desvio deliberado do exemplo original do pedido: `metadata` usa
 * `Record<string, unknown>`, não `Record<string, any>` — este projeto não
 * usa `any` em nenhuma camada (regra do time), `unknown` obriga quem lê o
 * campo a estreitar o tipo antes de usar, sem abrir mão da flexibilidade
 * de "qualquer metadado extra por canal".
 */
export interface HubMessage {
  id: string;
  channel: HubChannel;
  userId: string;
  /**
   * CONTROL HUB — Fase 8 (Gateway Omnichannel): identifica a CONVERSA
   * (não a mensagem individual) a que este envelope pertence — o "thread"
   * que agrupa turnos sucessivos do mesmo usuário no mesmo canal. Opcional
   * porque nem todo produtor de `HubMessage` passa por
   * `services/channel-gateway` ainda (ex.: os testes de integração deste
   * módulo e do Action Engine, que chamam `controlHub.receive` direto,
   * sem Gateway) — quando ausente, o pipeline funciona exatamente como
   * antes da Fase 8. Preenchido pelo `ConversationManager`
   * (`services/channel-gateway/conversation-manager.ts`), nunca pelo
   * adapter de canal — nenhum adapter sabe (nem precisa saber) como
   * conversas são localizadas/criadas.
   */
  conversationId?: string;
  type: HubMessageType;
  content: string;
  attachments?: Attachment[];
  metadata?: Record<string, unknown>;
  receivedAt: Date;
}

/** Resultado de `validateHubMessage` — a etapa "Validate" do pipeline. */
export interface HubValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * CONTROL HUB — Fase 2: o contexto que flui pelo pipeline agora é o
 * `UserContext` de `services/context-provider` (não mais um `HubContext`
 * próprio deste módulo — removido nesta fase). Ver
 * `services/context-provider/user-context.types.ts` para o tipo e o porquê
 * dele viver num módulo à parte: `UserContext` é o contrato entre o
 * CONTROL HUB e a NOVA, não algo específico de transporte/canal como
 * `HubMessage` acima — merece sua própria camada, testável e portável
 * independente do Hub.
 */

/** Resultado final do pipeline (etapa "Return Result") — o que `ControlHub.receive` devolve para o adapter de canal que chamou. */
export interface HubPipelineResult {
  status: 'ok' | 'rejected';
  message: HubMessage;
  /** Texto pronto para o canal devolver ao usuário. Ausente quando `status === 'rejected'`. */
  reply?: string;
  /** Presente só quando a validação falhou — motivo, para log/observabilidade do adapter. */
  error?: string;
  /**
   * CONTROL HUB — Fase 4 (Action Engine real): resultado de cada
   * `ActionRequest` que o Decision Engine pediu, na mesma ordem de
   * `DecisionResult.actions`. Ausente quando nenhuma ação foi proposta neste
   * turno (a maioria das mensagens só vira `reply`) — nunca um array vazio,
   * para diferenciar "não houve ação" de "houve ação, mas a lista está
   * vazia por algum motivo" (que nunca deveria acontecer).
   */
  actionResults?: ActionResult[];
  /**
   * CONTROL HUB — Fase 5 (Decision Engine com IA): "Observabilidade —
   * métricas simples: registrar tempo de montagem de contexto, chamada ao
   * LLM, execução das actions, tempo total. Não utilizar ferramentas
   * externas. Apenas estrutura preparada para evolução futura."
   *
   * `decisionMs` cobre a etapa "Decision Engine" inteira — quando o modo
   * ativo é `OpenAIDecisionProvider`, isso já INCLUI a chamada ao LLM
   * (`OpenAIDecisionProvider` também mede seus próprios sub-passos
   * internamente, ver `services/decision-engine/metrics.ts`, para
   * depuração mais fina sem inchar este tipo); quando o modo ativo é
   * `MockDecisionProvider`, é só o tempo do `parseIntent` determinístico.
   * Ausente só quando `status === 'rejected'` (a mensagem nem chegou a
   * entrar no pipeline de verdade — `validateHubMessage` barra antes de
   * qualquer etapa cronometrada rodar); presente em todo resultado `'ok'`.
   */
  metrics?: {
    contextMs: number;
    decisionMs: number;
    actionMs: number;
    totalMs: number;
  };
}
