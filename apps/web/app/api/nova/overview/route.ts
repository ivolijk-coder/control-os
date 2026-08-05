import { NextResponse } from 'next/server';
import { currentSessionUserId } from '@/services/auth/session';
import { dailyOverviewService, formatDailyOverviewReply } from '@/services/daily-overview';

export async function GET(): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ message: 'Faça login para consultar o resumo.' }, { status: 401 });
  try {
    const overview = await dailyOverviewService.getOverview(userId);
    return NextResponse.json({ overview, reply: formatDailyOverviewReply(overview) });
  } catch {
    return NextResponse.json({ message: 'Não foi possível montar o resumo operacional agora.' }, { status: 503 });
  }
}
