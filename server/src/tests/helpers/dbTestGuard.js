/**
 * dbTestGuard.js — Safety guard for the real-MySQL integration suites.
 *
 * These tests DELETE orders and must never run against a shared or production
 * database. Before any connection is opened the guarded suites call
 * assertSafeDbTestEnv(), which refuses to run when:
 *   - RUN_DB_TESTS=1 and DB_HOST is not 127.0.0.1 / localhost, or
 *   - RUN_DB_TESTS=1 and DB_NAME does not look like a test database
 *     (must match /(^|_)test$/i, e.g. "test", "gala_test", "gala_admin_test").
 *
 * The guard is a no-op unless RUN_DB_TESTS=1, so normal `npm test` runs are
 * unaffected.
 */

const LOCAL_DB_HOSTS = ['127.0.0.1', 'localhost'];
const TEST_DB_NAME_PATTERN = /(^|_)test$/i;

export function isLocalDbHost(host) {
  return LOCAL_DB_HOSTS.includes(String(host || '').trim().toLowerCase());
}

export function isTestDbName(name) {
  return TEST_DB_NAME_PATTERN.test(String(name || '').trim());
}

/**
 * Throw before any DB connection is attempted when the requested test run is
 * pointed at an unsafe host or database name.
 *
 * @param {NodeJS.ProcessEnv} [env]
 */
export function assertSafeDbTestEnv(env = process.env) {
  if (env.RUN_DB_TESTS !== '1') return;

  const host = String(env.DB_HOST || '').trim();
  if (host && !isLocalDbHost(host)) {
    throw new Error(
      `[db-tests] Refusing to run: DB_HOST="${host}" is not local. ` +
        'Only 127.0.0.1 or localhost is allowed for these destructive tests.'
    );
  }

  const dbName = String(env.DB_NAME || '').trim();
  if (!isTestDbName(dbName)) {
    throw new Error(
      `[db-tests] Refusing to run: DB_NAME="${dbName}" is not a test database. ` +
        'DB_NAME must match /(^|_)test$/i (for example "gala_test" or "test").'
    );
  }
}

export { LOCAL_DB_HOSTS, TEST_DB_NAME_PATTERN };
