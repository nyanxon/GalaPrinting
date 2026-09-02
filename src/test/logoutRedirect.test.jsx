// Regression guard: logout manual & session-expired mengarahkan staff ke
// /admin/login dan customer ke /register, memakai satu helper yang sama
// (getUserAuthPath) — tidak boleh ada per-role duplication.
import { describe, it, expect } from 'vitest';
import { getUserAuthPath } from '../components/context/AuthContext.jsx';
import { STAFF_ROLES } from '../config/roles.js';

describe('getUserAuthPath — logout / session-expired redirect', () => {
  it('mengarahkan SEMUA role staff ke /admin/login', () => {
    expect(STAFF_ROLES.length).toBeGreaterThan(0);
    for (const role of STAFF_ROLES) {
      expect(getUserAuthPath({ role }), `role=${role}`).toBe('/admin/login');
    }
  });

  it('mengarahkan customer ke /register', () => {
    expect(getUserAuthPath({ role: 'customer' })).toBe('/register');
    expect(getUserAuthPath(null)).toBe('/register');
    expect(getUserAuthPath({ role: 'unknown' })).toBe('/register');
  });
});