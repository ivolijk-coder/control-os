import { randomBytes, scryptSync } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { whatsAppIdentityService } from '@/services/identity';

function passwordHash(password: string): string {
  // O login com sessão real será o próximo passo. Já guardamos somente um
  // hash lento com salt, nunca a senha original, para não criar dívida de segurança.
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
    return NextResponse.json({ phone: registration.phone, code: registration.code, expiresAt: registration.expiresAt.toISOString() }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível criar sua conta agora.';
    return NextResponse.json({ message }, { status: 409 });
  }
}
