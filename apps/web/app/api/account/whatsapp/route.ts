import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentSessionUserId } from '@/services/auth/session';

export async function GET(): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ message: 'Faça login para ver sua configuração do WhatsApp.' }, { status: 401 });
  const link = await prisma.whatsAppLink.findFirst({ where: { userId }, select: { phoneE164: true, verifiedAt: true } });
  return NextResponse.json(link ? { status: 'active', phone: link.phoneE164, verifiedAt: link.verifiedAt.toISOString() } : { status: 'pending' });
}
