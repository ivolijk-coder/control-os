import type { FixedAccount } from '@control-os/types';
import type { CreateFixedAccountOccurrenceInput } from '@/services/repositories/finance/finance-repository.types';

const pad = (value: number) => String(value).padStart(2, '0');
const day = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
const iso = (date: Date) => day(date).toISOString();

function clampDay(year: number, month: number, dueDay: number): Date {
  return new Date(year, month + 1, 0).getDate() < dueDay
    ? new Date(year, month + 1, 0, 12)
    : new Date(year, month, dueDay, 12);
}

/** Gera fatos imutáveis. Não persiste nada e não recalcula ocorrências já criadas. */
export class FixedAccountGenerationService {
  build(account: FixedAccount, until: Date, now = new Date()): CreateFixedAccountOccurrenceInput[] {
    if (!account.active || account.archivedAt) return [];
    const start = day(new Date(account.startDate));
    const end = account.endDate ? day(new Date(account.endDate)) : undefined;
    const first = start > day(now) ? start : new Date(now.getFullYear(), now.getMonth(), 1, 12);
    const limit = end && end < day(until) ? end : day(until);
    if (first > limit) return [];
    const dates: Array<{ due: Date; reference: string }> = [];
    if (account.recurrence === 'mensal') {
      for (let cursor = new Date(first.getFullYear(), first.getMonth(), 1, 12); cursor <= limit; cursor.setMonth(cursor.getMonth() + 1)) {
        const due = clampDay(cursor.getFullYear(), cursor.getMonth(), account.dueDay);
        if (due >= start && due <= limit) dates.push({ due, reference: `${due.getFullYear()}-${pad(due.getMonth() + 1)}` });
      }
    } else if (account.recurrence === 'anual') {
      for (let year = first.getFullYear(); year <= limit.getFullYear(); year += 1) {
        const due = clampDay(year, start.getMonth(), account.dueDay);
        if (due >= start && due <= limit) dates.push({ due, reference: `${year}` });
      }
    } else {
      const interval = account.recurrence === 'semanal' ? 7 : Math.max(1, account.customIntervalDays ?? 30);
      for (let cursor = day(start); cursor <= limit; cursor.setDate(cursor.getDate() + interval)) {
        if (cursor >= first) dates.push({ due: new Date(cursor), reference: cursor.toISOString().slice(0, 10) });
      }
    }
    // O cursor persistido é uma otimização, não a garantia de integridade:
    // a chave única no repositório continua sendo a proteção definitiva
    // contra duas ocorrências para o mesmo período.
    const lastGenerated = account.lastGeneratedCompetence ?? '';
    return dates.filter(({ reference }) => reference > lastGenerated).map(({ due, reference }) => ({
      fixedAccountId: account.id,
      competenceMonth: due.getMonth() + 1,
      competenceYear: due.getFullYear(),
      referencePeriod: reference,
      dueDate: iso(due),
      name: account.name,
      description: account.description,
      type: account.type,
      origin: account.origin,
      categoryId: account.categoryId,
      paymentMethod: account.paymentMethod,
      sourceAccountId: account.sourceAccountId,
      destinationAccountId: account.destinationAccountId,
      amount: account.amount,
    }));
  }
}
