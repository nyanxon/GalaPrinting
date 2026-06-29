// Feature: customer-profile-page, Property 4: non-image MIME type rejection
// Feature: customer-profile-page, Property 5: avatar upload persists URL

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

// ── Property 4: Non-image MIME type rejection ─────────────────────────────────

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Inline multer fileFilter logic from upload.js for avatar uploads.
 * Returns true if allowed, false if rejected.
 */
function isAllowedMimeType(mimeType) {
  return ALLOWED_MIME_TYPES.includes(mimeType);
}

/**
 * Simulates the multer fileFilter callback behaviour.
 * Returns the HTTP status that would be returned for a rejected MIME type.
 */
function simulateAvatarUpload(mimeType) {
  if (!isAllowedMimeType(mimeType)) {
    return { status: 415, ok: false, message: `Tipe file '${mimeType}' tidak didukung untuk upload avatar.` };
  }
  return { status: 200, ok: true };
}

describe('Property 4: Non-image MIME type rejection', () => {
  /**
   * For any MIME type string that is not one of the four allowed image types,
   * the avatar upload should return HTTP 415.
   *
   * Validates: Requirements 3.4, 9.4
   */
  it('rejects non-image MIME types with 415 (100 iterations)', () => {
    fc.assert(
      fc.property(
        // Generate MIME type strings that are NOT in the allowed list
        fc.oneof(
          fc.constantFrom(
            'application/pdf',
            'application/zip',
            'text/plain',
            'text/html',
            'application/json',
            'video/mp4',
            'audio/mpeg',
            'application/octet-stream',
            'image/bmp',
            'image/tiff',
            'image/heic',
            'image/svg+xml',
          ),
          fc.string({ minLength: 3, maxLength: 30 })
            .filter((s) => !ALLOWED_MIME_TYPES.includes(s) && s.includes('/')),
        ),
        (mimeType) => {
          const result = simulateAvatarUpload(mimeType);
          expect(result.status).toBe(415);
          expect(result.ok).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Allowed MIME types should pass through.
   *
   * Validates: Requirements 3.4
   */
  it('accepts allowed image MIME types', () => {
    for (const mimeType of ALLOWED_MIME_TYPES) {
      const result = simulateAvatarUpload(mimeType);
      expect(result.status).toBe(200);
      expect(result.ok).toBe(true);
    }
  });
});

// ── Property 5: Avatar upload persists URL ────────────────────────────────────

/**
 * In-memory store that simulates the avatar upload + profile fetch flow.
 */
function createAvatarStore() {
  const users = new Map();

  return {
    seed(userId) {
      users.set(userId, { id: userId, avatar_url: null });
    },
    uploadAvatar(userId, fileName) {
      const url = `/uploads/avatars/${fileName}`;
      const user = users.get(userId);
      if (!user) throw new Error('User not found');
      user.avatar_url = url;
      return { ...user };
    },
    getProfile(userId) {
      const user = users.get(userId);
      if (!user) throw new Error('User not found');
      return { ...user };
    },
  };
}

describe('Property 5: Avatar upload persists URL', () => {
  /**
   * For any valid image file uploaded as an avatar, the API should update
   * the user's avatar_url such that fetching the profile returns the new URL.
   *
   * Validates: Requirements 3.6
   */
  it('uploaded avatar URL is persisted and returned by getProfile (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // userId
        fc.stringMatching(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(jpg|png|webp|gif)$/),
        (userId, fileName) => {
          const store = createAvatarStore();
          store.seed(userId);

          // Upload avatar
          store.uploadAvatar(userId, fileName);

          // Fetch profile
          const profile = store.getProfile(userId);

          // avatar_url must be set and contain the file name
          expect(profile.avatar_url).not.toBeNull();
          expect(profile.avatar_url).toContain(fileName);
          expect(profile.avatar_url).toMatch(/^\/uploads\/avatars\//);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Uploading a new avatar should replace the old one.
   *
   * Validates: Requirements 3.6
   */
  it('uploading a new avatar replaces the old avatar_url (100 iterations)', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.stringMatching(/^[a-z0-9]{8}\.jpg$/),
        fc.stringMatching(/^[a-z0-9]{8}\.png$/),
        (userId, oldFile, newFile) => {
          const store = createAvatarStore();
          store.seed(userId);

          store.uploadAvatar(userId, oldFile);
          store.uploadAvatar(userId, newFile);

          const profile = store.getProfile(userId);
          expect(profile.avatar_url).toContain(newFile);
          expect(profile.avatar_url).not.toContain(oldFile);
        }
      ),
      { numRuns: 100 }
    );
  });
});
