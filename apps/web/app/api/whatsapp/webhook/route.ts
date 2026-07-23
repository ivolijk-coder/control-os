import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { channelGateway } from '@/services/channel-gateway';

export const runtime = 'nodejs';

type MetaChange = {
  value?: { messages?: Array<{ id?: string; from?: string; timestamp?: string; type?: string; text?: { body?: string } }> };
};

/** Verificação exigida pela Meta ao cadastrar a URL do webhook. */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (
    params.get('hub.mode') === 'subscribe' &&
    params.get('hub.verify_token') === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  ) {
    return new NextResponse(params.get('hub.challenge') ?? '', { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

/** Recebe mensagens da Cloud API e as entrega ao pipeline único do CONTROL OS. */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const secret = process.env.WHATSAPP_APP_SECRET;
  const signature = request.headers.get('x-hub-signature-256');
  const expected = secret ? `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}` : '';
  if (!signature || !expected || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  let payload: { entry?: Array<{ changes?: MetaChange[] }> } | null;
  try {
    payload = JSON.parse(rawBody) as { entry?: Array<{ changes?: MetaChange[] }> };
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }
  if (!payload?.entry) return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });

  const jobs: Promise<unknown>[] = [];
  for (const entry of payload.entry) for (const change of entry.changes ?? []) {
    for (const message of change.value?.messages ?? []) {
      if (message.type !== 'text' || !message.from || !message.text?.body) continue;
      jobs.push(channelGateway.receiveMessage('whatsapp', {
        from: `+${message.from}`,
        text: message.text.body,
        receivedAt: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString(),
        messageId: message.id,
      }));
    }
  }
  await Promise.all(jobs);
  return NextResponse.json({ received: true });
}
