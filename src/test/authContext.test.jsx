// Feature: vanilla-to-react-migration, Property 6: AuthContext user update propagates
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import { AuthContext, AuthProvider } from '../components/context/AuthContext.jsx';
import { useContext } from 'react';

// Mock authService so getCurrentUser returns null initially
vi.mock('../services/auth.js', () => ({
  getCurrentUser: vi.fn(() => null),
}));

// A simple consumer component that displays the current user
function UserConsumer() {
  const { user } = useContext(AuthContext);
  return (
    <div data-testid="user-display">
      {user ? JSON.stringify(user) : 'null'}
    </div>
  );
}

// A component that exposes updateUser for testing
function UpdaterConsumer({ onMount }) {
  const { updateUser } = useContext(AuthContext);
  // Call onMount with updateUser so tests can trigger updates
  if (onMount) onMount(updateUser);
  return null;
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initialises user as null when getCurrentUser returns null', () => {
    render(
      <AuthProvider>
        <UserConsumer />
      </AuthProvider>
    );
    expect(screen.getByTestId('user-display').textContent).toBe('null');
  });

  /**
   * Property 6: AuthContext user update propagates
   * Validates: Requirements 4.4
   *
   * For any user object passed to updateUser, all components consuming AuthContext
   * SHALL observe the new user value on their next render without a page reload.
   */
  it('Property 6: AuthContext user update propagates to all consumers', () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.string({ minLength: 1 }),
          name: fc.string({ minLength: 1 }),
          role: fc.constantFrom('customer', 'admin', 'owner'),
        }),
        (user) => {
          let capturedUpdateUser = null;

          const { unmount } = render(
            <AuthProvider>
              <UpdaterConsumer onMount={(fn) => { capturedUpdateUser = fn; }} />
              <UserConsumer />
            </AuthProvider>
          );

          // Initially null
          expect(screen.getByTestId('user-display').textContent).toBe('null');

          // Call updateUser with the generated user
          act(() => {
            capturedUpdateUser(user);
          });

          // Consumer should now reflect the new user
          const displayed = screen.getByTestId('user-display').textContent;
          const parsed = JSON.parse(displayed);
          expect(parsed).toEqual(user);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
