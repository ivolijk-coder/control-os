import { NextRequest, NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';

const OPENAI_SPEECH_URL = 'https://api.openai.com/v1/audio/speech';
const VOICES = new Set(['alloy', 'ash', 'ballad', 'cedar', 'coral', 'echo', 'fable', 'marin', 'nova', 'onyx', 'sage', 'shimmer', 'verse']);

const VOICE_INSTRUCTIONS = {
  nova: 'Fale em português brasileiro natural, com calor humano e clareza. Soe como uma assistente atenta conversando com seu chefe, nunca como robô ou locutora. Use ritmo calmo, frases curtas e uma energia acolhedora.',
  legendary: 'Fale em português brasileiro natural, com presença serena e confiança. Soe como um mentor estratégico experiente, humano e direto. Use ritmo calmo, pausas leves e frases curtas; nunca pareça uma locução robótica.',
} as const;

/** Gera áudio no servidor para que a chave OpenAI nunca chegue ao navegador. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!currentSessionUserId()) return NextResponse.json({ message: 'Faça login para usar a voz.' }, { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ message: 'A voz premium ainda não está configurada.' }, { status: 503 });

  const body = await request.json().catch(() => undefined) as Record<string, unknown> | undefined;
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const requestedVoice = typeof body?.voice === 'string' ? body.voice : 'nova';
  const persona = body?.persona === 'legendary' ? 'legendary' : 'nova';
  const voice = VOICES.has(requestedVoice) ? requestedVoice : 'nova';

  if (!text) return NextResponse.json({ message: 'Nenhum texto para transformar em áudio.' }, { status: 400 });
  if (text.length > 4_000) return NextResponse.json({ message: 'A resposta é longa demais para áudio.' }, { status: 400 });

  try {
    const response = await fetch(OPENAI_SPEECH_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts',
        voice,
        input: text,
        instructions: VOICE_INSTRUCTIONS[persona],
        response_format: 'mp3',
        speed: 0.98,
      }),
    });
    if (!response.ok || !response.body) {
      return NextResponse.json({ message: 'Não foi possível gerar a voz agora.' }, { status: 502 });
    }

    return new NextResponse(response.body, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({ message: 'Não foi possível conectar ao serviço de voz.' }, { status: 502 });
  }
}
