import type {
  AgendaEvent,
  Asset,
  FinanceEntry,
  Habit,
  Mission,
  Note,
  NovaMessage,
  PersonalDocument,
} from '@control-os/types';

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
 * Contexto agregado pelo Context Manager antes da NOVA processar a
 * mensagem — nunca contém superfície de escrita (nenhum `actions`/setter),
 * só leitura, mesmo princípio já usado por `NovaReadOnlyContext` em
 * `services/nova/interfaces`. Reaproveita os tipos de domínio existentes
 * (`@control-os/types`) em vez de inventar formas novas para os mesmos
 * dados.
 */
export interface HubContext {
  userId: string;
  agenda: AgendaEvent[];
  financeiro: FinanceEntry[];
  metas: Mission[];
  habitos: Habit[];
  patrimonio: Asset[];
  notas: Note[];
  documentos: PersonalDocument[];
  conversasRecentes: NovaMessage[];
}

/** `HubContext` "vazio" — usado pelo `StubContextManager` (ver `context-manager.ts`) enquanto não existe uma fonte de dados real por trás do Hub. */
export function createEmptyHubContext(userId: string): HubContext {
  return {
    userId,
    agenda: [],
    financeiro: [],
    metas: [],
    habitos: [],
    patrimonio: [],
    notas: [],
    documentos: [],
    conversasRecentes: [],
  };
}

/** Resultado final do pipeline (etapa "Return Result") — o que `ControlHub.receive` devolve para o adapter de canal que chamou. */
export interface HubPipelineResult {
  status: 'ok' | 'rejected';
  message: HubMessage;
  /** Texto pronto para o canal devolver ao usuário. Ausente quando `status === 'rejected'`. */
  reply?: string;
  /** Presente só quando a validação falhou — motivo, para log/observabilidade do adapter. */
  error?: string;
}
