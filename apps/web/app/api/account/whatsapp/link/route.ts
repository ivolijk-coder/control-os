import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { whatsAppIdentityService } from '@/services/identity';

/** Reabre o desafio de vínculo para a conta atualmente logada. */
export async function POST(): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ message: 'Faça login para vincular seu WhatsApp.' }, { status: 401 });
  try {
    return NextResponse.json(await whatsAppIdentityService.restartVerification(userId));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível iniciar o vínculo agora.';
    return NextResponse.json({ message }, { status: 409 });
  }
}
