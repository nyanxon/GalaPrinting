import { describe, it, expect } from 'vitest';
import {
  assertSafeDbTestEnv,
  isLocalDbHost,
  isTestDbName,
} from './helpers/dbTestGuard.js';

function env(overrides = {}) {
  return { RUN_DB_TESTS: '1', ...overrides };
}

describe('dbTestGuard', () => {
  it('is a no-op unless RUN_DB_TESTS=1', () => {
    expect(() =>
      assertSafeDbTestEnv({ DB_HOST: 'db.example.com', DB_NAME: 'production' })
    ).not.toThrow();
    expect(() =>
      assertSafeDbTestEnv({ RUN_DB_TESTS: '0', DB_HOST: 'db.example.com' })
    ).not.toThrow();
  });

  it('accepts only local hosts', () => {
    expect(isLocalDbHost('127.0.0.1')).toBe(true);
    expect(isLocalDbHost('localhost')).toBe(true);
    expect(isLocalDbHost(' LOCALHOST ')).toBe(true);
    expect(isLocalDbHost('db.example.com')).toBe(false);
    expect(isLocalDbHost('10.0.0.5')).toBe(false);
  });

  it('accepts only database names ending in test', () => {
    expect(isTestDbName('test')).toBe(true);
    expect(isTestDbName('gala_test')).toBe(true);
    expect(isTestDbName('gala_admin_test')).toBe(true);
    expect(isTestDbName('GALA_TEST')).toBe(true);
    expect(isTestDbName('gala')).toBe(false);
    expect(isTestDbName('galatest')).toBe(false);
    expect(isTestDbName('gala_test_prod')).toBe(false);
    expect(isTestDbName('')).toBe(false);
  });

  it('throws for a non-local host', () => {
    expect(() =>
      assertSafeDbTestEnv(env({ DB_HOST: 'db.example.com', DB_NAME: 'gala_test' }))
    ).toThrow(/DB_HOST="db\.example\.com" is not local/);

    expect(() =>
      assertSafeDbTestEnv(env({ DB_HOST: '10.0.0.5', DB_NAME: 'gala_test' }))
    ).toThrow(/is not local/);
  });

  it('throws for a database name that is not a test database', () => {
    expect(() =>
      assertSafeDbTestEnv(env({ DB_HOST: '127.0.0.1', DB_NAME: 'gala' }))
    ).toThrow(/DB_NAME="gala" is not a test database/);

    expect(() =>
      assertSafeDbTestEnv(env({ DB_HOST: '127.0.0.1', DB_NAME: 'galatest' }))
    ).toThrow(/is not a test database/);
  });

  it('throws when DB_NAME is missing so an unproven database is never touched', () => {
    expect(() => assertSafeDbTestEnv(env({ DB_HOST: '127.0.0.1' }))).toThrow(
      /DB_NAME="" is not a test database/
    );
  });

  it('allows a local host with a test-named database', () => {
    expect(() =>
      assertSafeDbTestEnv(env({ DB_HOST: '127.0.0.1', DB_NAME: 'gala_test' }))
    ).not.toThrow();
    expect(() =>
      assertSafeDbTestEnv(env({ DB_HOST: 'localhost', DB_NAME: 'test' }))
    ).not.toThrow();
  });
});
