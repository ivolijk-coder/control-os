import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'controlos_session';

function secret(): string {
  const value = process.env.WEB_SESSION_SECRET;
  if (!value) throw new Error('WEB_SESSION_SECRET não configurado.');
  return value;
}

function sign(userId: string): string {
  return createHmac('sha256', secret()).update(userId).digest('hex');
}

export function sessionValue(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

export function currentSessionUserId(): string | undefined {
  const value = cookies().get(COOKIE_NAME)?.value;
  const [userId, signature] = value?.split('.') ?? [];
  if (!userId || !signature) return undefined;
  const expected = sign(userId);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return undefined;
  return userId;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
