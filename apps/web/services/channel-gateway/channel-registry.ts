import type { ChannelAdapter, HubChannel } from '@/services/control-hub';

/**
 * Channel Registry — CONTROL HUB Fase 8 (Gateway Omnichannel).
 *
 * "Registrar canais dinamicamente." Nenhum código no `ChannelGateway`
 * (`channel-gateway.ts`) importa `channels/whatsapp` ou `channels/web`
 * diretamente — ele só pergunta ao registro "qual adapter cuida do canal
 * X?". Isso é o que torna adicionar um canal novo (Telegram, e-mail,
 * voz, API pública) uma mudança de UMA linha (`register(novoAdapter)`
 * em `index.ts`, o composition root deste módulo), nunca uma mudança no
 * Gateway em si.
 *
 * Registrados HOJE (ver `index.ts`): Web Chat, WhatsApp Mock — exatamente
 * os dois canais pedidos nesta fase. `channels/app` e `channels/api`
 * continuam como reservas de interface (sem adapter concreto ainda, ver
 * aqueles arquivos) — não registrados aqui de propósito, mesmo princípio
 * de `HubChannel` nunca ter um membro "morto".
 */
export interface ChannelRegistry {
  register(adapter: ChannelAdapter): void;
  get(channel: HubChannel): ChannelAdapter | undefined;
  list(): ChannelAdapter[];
}

class InMemoryChannelRegistry implements ChannelRegistry {
  private readonly adaptersByChannel = new Map<HubChannel, ChannelAdapter>();

  register(adapter: ChannelAdapter): void {
    this.adaptersByChannel.set(adapter.channel, adapter);
  }

  get(channel: HubChannel): ChannelAdapter | undefined {
    return this.adaptersByChannel.get(channel);
  }

  list(): ChannelAdapter[] {
    return Array.from(this.adaptersByChannel.values());
  }
}

export const channelRegistry: ChannelRegistry = new InMemoryChannelRegistry();
