import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { financialIntelligenceService } from '@/services/financial-intelligence/financial-intelligence.sources';

/**
 * Visão financeira consolidada para consumidores autenticados. A identidade
 * é sempre derivada da sessão; esta rota não lê query, body ou headers.
 */
export async function GET(): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { success: false, message: 'Faça login para consultar sua situação financeira.' },
      { status: 401 }
    );
  }

  try {
    const status = await financialIntelligenceService.getStatus(userId);
    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Falha ao consultar inteligência financeira:', error);
    return NextResponse.json(
      { success: false, message: 'Não foi possível consultar sua situação financeira agora.' },
      { status: 500 }
    );
  }
}
