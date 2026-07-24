import { createHash, randomInt } from 'node:crypto';
import { prisma } from '@/lib/prisma';

const VERIFICATION_TTL_MS = 15 * 60 * 1000;
const VERIFY_COMMAND = /^\s*vincular\s+(\d{6})\s*$/i;

export function normalizeWhatsAppPhone(value: string): string | undefined {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : undefined;
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export class WhatsAppIdentityService {
  async beginRegistration(input: { name: string; email: string; passwordHash: string; phone: string }) {
    const phone = normalizeWhatsAppPhone(input.phone);
    if (!phone) throw new Error('Informe um número de WhatsApp válido com DDD.');
    if (await prisma.whatsAppLink.findUnique({ where: { phoneE164: phone } })) {
      throw new Error('Esse número de WhatsApp já está vinculado a outra conta.');
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.appUser.create({ data: { name: input.name, email: input.email.toLowerCase(), passwordHash: input.passwordHash } });
      await tx.whatsAppVerification.upsert({
        where: { phoneE164: phone },
        create: { userId: created.id, phoneE164: phone, codeHash: hashCode(code), expiresAt },
        update: { userId: created.id, codeHash: hashCode(code), expiresAt },
      });
      return created;
    });
    return { userId: user.id, phone, code, expiresAt };
  }

  async resolveUserId(phone: string): Promise<string | undefined> {
    const phoneE164 = normalizeWhatsAppPhone(phone);
    if (!phoneE164) return undefined;
    return (await prisma.whatsAppLink.findUnique({ where: { phoneE164 }, select: { userId: true } }))?.userId;
  }

  /**
   * Gera um novo código para quem criou a conta, mas não conseguiu concluir
   * a conversa no WhatsApp. O número continua sendo o informado no cadastro;
   * nunca aceitamos uma troca silenciosa de número nesta etapa.
   */
  async restartVerification(userId: string) {
    const pending = await prisma.whatsAppVerification.findFirst({ where: { userId } });
    if (!pending) throw new Error('Não existe um número pendente para vincular nesta conta.');
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS);
    await prisma.whatsAppVerification.update({
      where: { id: pending.id },
      data: { codeHash: hashCode(code), expiresAt },
    });
    return { phone: pending.phoneE164, code, expiresAt };
  }

  async confirmFromMessage(phone: string, text: string): Promise<'confirmed' | 'invalid' | 'not_a_command'> {
    const code = text.match(VERIFY_COMMAND)?.[1];
    if (!code) return 'not_a_command';
    const phoneE164 = normalizeWhatsAppPhone(phone);
    if (!phoneE164) return 'invalid';
    const pending = await prisma.whatsAppVerification.findUnique({ where: { phoneE164 } });
    if (!pending || pending.expiresAt.getTime() < Date.now() || pending.codeHash !== hashCode(code)) return 'invalid';
    await prisma.$transaction([
      prisma.whatsAppLink.upsert({
        where: { phoneE164 },
        create: { userId: pending.userId, phoneE164, verifiedAt: new Date() },
        update: { userId: pending.userId, verifiedAt: new Date() },
      }),
      prisma.whatsAppVerification.delete({ where: { phoneE164 } }),
    ]);
    return 'confirmed';
  }
}

export const whatsAppIdentityService = new WhatsAppIdentityService();
