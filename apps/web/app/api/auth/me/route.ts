import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentSessionUserId } from '@/services/auth/session';

/** Dados mínimos da conta autenticada, usados pela área de configurações. */
export async function GET(): Promise<NextResponse> {
  const userId = currentSessionUserId();
  if (!userId) return NextResponse.json({ message: 'Faça login.' }, { status: 401 });

  const user = await prisma.appUser.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!user) return NextResponse.json({ message: 'Conta não encontrada.' }, { status: 401 });
  return NextResponse.json({ user });
}
