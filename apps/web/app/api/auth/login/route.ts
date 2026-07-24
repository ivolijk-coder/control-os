import { scryptSync, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE_NAME, sessionValue } from '@/services/auth/session';

function passwordMatches(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString('hex');
  return actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => undefined) as Record<string, unknown> | undefined;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const user = email ? await prisma.appUser.findUnique({ where: { email } }) : undefined;
  if (!user || !passwordMatches(password, user.passwordHash)) {
    return NextResponse.json({ message: 'E-mail ou senha incorretos.' }, { status: 401 });
  }
  const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email } });
  response.cookies.set(SESSION_COOKIE_NAME, sessionValue(user.id), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return response;
}
