import { NextRequest, NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';

const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/** Transcreve a gravação do navegador, inclusive onde Web Speech não existe (Firefox). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!currentSessionUserId()) return NextResponse.json({ message: 'Faça login para usar o microfone.' }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ message: 'A transcrição ainda não está configurada.' }, { status: 503 });

  const form = await request.formData().catch(() => undefined);
  const audio = form?.get('audio');
  if (!(audio instanceof File)) return NextResponse.json({ message: 'Não recebemos uma gravação de áudio.' }, { status: 400 });
  if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) return NextResponse.json({ message: 'A gravação precisa ter até 10 MB.' }, { status: 400 });

  const upstreamForm = new FormData();
  upstreamForm.set('file', audio, audio.name || 'mensagem.webm');
  upstreamForm.set('model', process.env.OPENAI_TRANSCRIPTION_MODEL ?? 'gpt-4o-mini-transcribe');
  upstreamForm.set('language', 'pt');
  upstreamForm.set('response_format', 'json');

  try {
    const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    });
    const payload = await response.json().catch(() => undefined) as { text?: unknown } | undefined;
    const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
    if (!response.ok || !text) return NextResponse.json({ message: 'Não foi possível transcrever este áudio.' }, { status: 502 });
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ message: 'Não foi possível conectar ao serviço de transcrição.' }, { status: 502 });
  }
}
