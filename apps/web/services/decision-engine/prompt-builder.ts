import { memoryService } from '@/services/memory';
import type { MemoryEntry } from '@/services/memory';
import type { HubMessage } from '@/services/control-hub';
import type { UserContext } from '@/services/context-provider';
import type { Capability } from '@/services/capability.types';
import { capabilityRegistry } from './capability-registry';
import type { CapabilityRegistry } from './capability-registry';

/**
 * Prompt Builder (CONTROL HUB — Fase 5). "Monta automaticamente o prompt
 * enviado ao modelo utilizando: Capabilities, UserContext, Memory Layer,
 * mensagem atual. O Decision Engine não deverá montar prompts manualmente."
 *
 * Único lugar de todo o sistema que conhece a FORMA textual do prompt —
 * `OpenAIDecisionProvider` só chama `build(...)` e manda o resultado pro
 * `LLMProvider`, nunca concatena string nenhuma sozinho. Trocar o texto do
 * prompt (tom, ordem das seções, formato) é mudar só este arquivo.
 */
export interface PromptBuilder {
  build(message: HubMessage, context: UserContext): Promise<string>;
}

/**
 * Namespace de memória de curto prazo usado aqui — `HubMessage` (diferente
 * de `AIConversationContext`, o tipo do pipeline de conversa antigo) não
 * carrega persona nenhuma (NOVA/LEGENDARY é um conceito da UI de chat, não
 * do Control Hub, que é canal-agnóstico). `'nova'` é o namespace padrão já
 * usado como persona-base em `services/memory` — razoável até o Control Hub
 * ganhar uma noção própria de persona/perfil de assistente, se algum dia
 * precisar.
 */
const SHORT_TERM_NAMESPACE = 'nova';
const RECENT_MEMORY_LIMIT = 5;

export class DecisionPromptBuilder implements PromptBuilder {
  constructor(private readonly capabilities: CapabilityRegistry = capabilityRegistry) {}

  async build(message: HubMessage, context: UserContext): Promise<string> {
    // "Memory Layer" — Fase 3: `recall` (últimas N do curto prazo) +
    // `search('long_term', '')` (TODOS os fatos de longo prazo — `query`
    // vazia = todas as entradas do escopo, contrato já documentado em
    // `MemoryProvider.search`). Rodam em paralelo — nenhuma depende da outra.
    const [recentMemory, longTermMemory] = await Promise.all([
      memoryService.recall({ scope: 'short_term', namespace: SHORT_TERM_NAMESPACE }, RECENT_MEMORY_LIMIT),
      memoryService.search('long_term', ''),
    ]);

    const sections = [
      buildRoleSection(),
      buildCapabilitiesSection(this.capabilities.list()),
      buildContextSection(context),
      buildMemorySection(recentMemory, longTermMemory),
      buildMessageSection(message),
      buildOutputFormatSection(),
    ];

    return sections.join('\n\n');
  }
}

function buildRoleSection(): string {
  return (
    'Você é o Decision Engine do CONTROL OS. Sua única tarefa é decidir, a partir da mensagem do usuário, ' +
    'quais ações (Actions) do sistema devem ser executadas. Você nunca executa nada diretamente — só decide.'
  );
}

/** "A IA nunca deverá inventar Actions. Ela deverá escolher apenas Actions registradas." — o texto abaixo deixa isso explícito, e a lista vem 100% de `CapabilityRegistry.list()` (nunca escrita à mão aqui). */
function buildCapabilitiesSection(capabilities: Capability[]): string {
  const lines = capabilities.map((capability) => {
    const parameterList =
      capability.parameters.length > 0
        ? capability.parameters
            .map((parameter) => `${parameter.name} (${parameter.type}, ${parameter.required ? 'obrigatório' : 'opcional'}): ${parameter.description}`)
            .join('; ')
        : 'nenhum';
    const exampleLines = capability.examples.map((example) => `    Exemplo: ${example}`).join('\n');
    return `  - ${capability.kind}: ${capability.description}\n    Parâmetros: ${parameterList}\n${exampleLines}`;
  });
  return `Capacidades disponíveis (escolha SOMENTE entre estas — nunca proponha uma ação que não esteja aqui):\n${lines.join('\n')}`;
}

/** Só campos já expostos por `UserContext` (Fase 2) — nenhum campo novo inventado aqui. Contagens, não os registros inteiros: manter o prompt compacto ("nunca enviar contexto desnecessário", mesmo princípio já aplicado em `buildModelContextSummary`, `services/ai/context`). */
function buildContextSection(context: UserContext): string {
  const lines = [
    `Data de referência: ${context.runtime.referenceDate}`,
    `Nome do usuário: ${context.profile?.name ?? 'indisponível'}`,
    `Documentos guardados: ${context.documents?.total ?? 'indisponível'}`,
    `Pendências operacionais: ${context.operationalTasks ? context.operationalTasks.pending + context.operationalTasks.waitingUser : 'indisponível'}`,
    `Cobertura: ${context.coverage.map((entry) => `${entry.domain}=${entry.status}`).join(', ')}`,
    'Dados financeiros mutáveis devem ser consultados pela capability financial_status.get; este resumo não substitui essa consulta.',
  ];
  return `Contexto do usuário:\n${lines.join('\n')}`;
}

function buildMemorySection(recentMemory: MemoryEntry[], longTermMemory: MemoryEntry[]): string {
  const recentLines = recentMemory.length > 0 ? recentMemory.map((entry) => `- ${entry.content}`).join('\n') : '(nenhuma)';
  const longTermLines = longTermMemory.length > 0 ? longTermMemory.map((entry) => `- ${entry.content}`).join('\n') : '(nenhum)';
  return `Memória recente da conversa:\n${recentLines}\n\nFatos de longo prazo conhecidos sobre o usuário:\n${longTermLines}`;
}

function buildMessageSection(message: HubMessage): string {
  return `Mensagem atual do usuário: "${message.content}"`;
}

/** "Saída do modelo: deverá responder apenas com um JSON estruturado, nunca texto livre." Contrato exato exigido de `parseLLMDecisionResponse` (`services/decision-engine/parse-llm-decision.ts`). */
function buildOutputFormatSection(): string {
  return [
    'Responda APENAS com um JSON no formato exato abaixo — sem nenhum texto fora do JSON, sem explicação, sem markdown:',
    '{"actions": [{"kind": "<uma das capacidades acima>", "confidence": <número de 0 a 1>, "parameters": {...}}]}',
    'Se nenhuma ação for necessária, responda exatamente {"actions": []}.',
  ].join('\n');
}
