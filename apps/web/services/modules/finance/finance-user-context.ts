import { AsyncLocalStorage } from 'node:async_hooks';

const financeUserStorage = new AsyncLocalStorage<string>();

export function runAsFinanceUser<T>(userId: string, work: () => Promise<T>): Promise<T> {
  return financeUserStorage.run(userId, work);
}

export function currentFinanceUserId(): string | undefined {
  return financeUserStorage.getStore();
}
