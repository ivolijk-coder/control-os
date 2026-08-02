import 'server-only';

import { getFinancialDashboard } from './financial-contract.service';
import type { FinancialInstallmentWithContract } from './financial-contract.types';

/**
 * `FinancialReminderService` (script seção 8) — narra em linguagem natural
 * as parcelas de `FinancialContract` vencendo em breve, para a NOVA usar em
 * chat. Só formata o que `getFinancialDashboard` já calcula — nenhuma
 * consulta própria, "nunca duplicar regras" (mesmo princípio já documentado
 * em `document-proposal-confirmation.service.ts`).
 */

function formatCurrencyBRL(amount: number): string {
  // `toLocaleString('pt-BR', ...)` usa NBSP (U+00A0) entre "R$" e o valor —
  // troca por espaço normal para casar com o exemplo do script ("R$ 6.000
  // dia 24") e evitar um caractere invisível estranho no chat da NOVA.
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
}

function formatDueDay(iso: string): string {
  const date = new Date(iso);
  return String(date.getDate()).padStart(2, '0');
}

function describeInstallment(installment: FinancialInstallmentWithContract): string {
  const label = installment.contractInstitution ? `${installment.contractInstitution} ${installment.contractName}` : installment.contractName;
  return `${label}: ${formatCurrencyBRL(installment.amount)} dia ${formatDueDay(installment.dueDate)}`;
}

/**
 * Ex. do script: "Você tem 3 parcelas vencendo essa semana: Santander
 * Pronampe: R$ 6.000 dia 24 / Bradesco: R$ 3.528 dia 17 / Koin: R$ 757 dia 20".
 * Devolve `undefined` quando não há nada a lembrar (a NOVA decide se cala
 * nesse caso — não há frase "nada vencendo" forçada).
 */
export async function buildFinancialWeeklyReminder(userId: string, reference?: Date): Promise<string | undefined> {
  const dashboard = await getFinancialDashboard(userId, reference);
  if (!dashboard.dueThisWeek.length) return undefined;

  const lines = dashboard.dueThisWeek.map(describeInstallment).join('\n');
  const count = dashboard.dueThisWeek.length;
  const noun = count === 1 ? 'parcela vencendo' : 'parcelas vencendo';
  return `Você tem ${count} ${noun} essa semana:\n${lines}`;
}

/** Variante para as parcelas atrasadas — mesmo formato, tom de alerta. */
export async function buildFinancialOverdueReminder(userId: string, reference?: Date): Promise<string | undefined> {
  const dashboard = await getFinancialDashboard(userId, reference);
  if (!dashboard.overdue.length) return undefined;

  const lines = dashboard.overdue.map(describeInstallment).join('\n');
  const count = dashboard.overdue.length;
  const noun = count === 1 ? 'parcela atrasada' : 'parcelas atrasadas';
  return `Você tem ${count} ${noun}:\n${lines}`;
}
