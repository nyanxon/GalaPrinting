/**
 * ChatAvatar.jsx
 *
 * Reusable avatar component for chat conversations.
 * Shows the user's profile picture if available, otherwise falls back
 * to a coloured circle with the first letter of their name.
 *
 * Props:
 *   name      {string}  — Display name (used for initial + accessible label)
 *   avatarUrl {string|null} — Relative or absolute avatar URL from the API
 *   size      {number}  — Width/height in px (default: 38)
 *   className {string}  — Extra CSS class (default: 'chat-conv-avatar')
 */

import { resolveApiUrl } from '../../core/httpClient.js';

export default function ChatAvatar({ name = '?', avatarUrl = null, size = 38, className = 'chat-conv-avatar' }) {
  const initial  = (name || '?')[0].toUpperCase();
  const resolved = avatarUrl ? resolveApiUrl(avatarUrl) : null;

  if (resolved) {
    return (
      <img
        src={resolved}
        alt={name}
        className={`${className} chat-conv-avatar--img`}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={(e) => {
          // If image fails to load, hide img and show fallback via CSS
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextSibling && (e.currentTarget.nextSibling.style.display = 'flex');
        }}
      />
    );
  }

  return (
    <div
      className={className}
      aria-label={name}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </div>
  );
}
