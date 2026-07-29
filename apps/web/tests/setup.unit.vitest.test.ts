import { describe, expect, it } from 'vitest';
import { assertSafeTestDatabaseUrl } from './setup';

describe('proteção do ambiente de testes', () => {
  it('aceita banco local explicitamente de teste', () => {
    expect(() => assertSafeTestDatabaseUrl('postgresql://user:pass@localhost:5432/control_os_test')).not.toThrow();
  });

  it('bloqueia banco remoto sem identificação de teste', () => {
    expect(() => assertSafeTestDatabaseUrl('postgresql://user:pass@db.example.com:5432/control_os'))
      .toThrow(/bloqueados/i);
  });

  it('bloqueia URL inválida', () => {
    expect(() => assertSafeTestDatabaseUrl('não-é-url')).toThrow(/inválida/i);
  });
});
