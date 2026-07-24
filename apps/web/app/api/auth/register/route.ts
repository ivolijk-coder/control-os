import { randomBytes, scryptSync } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { whatsAppIdentityService } from '@/services/identity';
import { SESSION_COOKIE_NAME, sessionValue } from '@/services/auth/session';

function passwordHash(password: string): string {
  // Guardamos somente um hash lento com salt, nunca a senha original.
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => undefined) as Record<string, unknown> | undefined;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const phone = typeof body?.phone === 'string' ? body.phone : '';
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !phone) {
    return NextResponse.json({ message: 'Confira nome, e-mail, senha e WhatsApp.' }, { status: 400 });
  }
  try {
    const registration = await whatsAppIdentityService.beginRegistration({ name, email, passwordHash: passwordHash(password), phone });
    const response = NextResponse.json({ phone: registration.phone, code: registration.code, expiresAt: registration.expiresAt.toISOString() }, { status: 201 });
    response.cookies.set(SESSION_COOKIE_NAME, sessionValue(registration.userId), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível criar sua conta agora.';
    return NextResponse.json({ message }, { status: 409 });
  }
}
