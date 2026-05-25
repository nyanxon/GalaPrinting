/**
 * EmojiPickerButton.jsx — A toggle button that shows/hides an emoji picker.
 * Uses @emoji-mart/react (fully offline, no API key needed).
 *
 * Props:
 *   onEmojiSelect(emoji) — called with the native emoji string when user picks one
 *   inputRef            — optional ref to the input/textarea to focus after picking
 */

import { useState, useEffect, useRef } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

/* Force the emoji-mart web component to a compact size */
const PICKER_STYLE = `
  em-emoji-picker {
    height: 300px !important;
    max-height: 300px !important;
    width: 280px !important;
    min-width: 280px !important;
    font-size: 13px !important;
  }
`;

export default function EmojiPickerButton({ onEmojiSelect, inputRef }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Close picker when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function handleSelect(emoji) {
    onEmojiSelect(emoji.native);
    if (inputRef?.current) {
      inputRef.current.focus();
    }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Emoji"
        aria-label="Buka emoji picker"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '20px',
          lineHeight: 1,
          padding: '4px 5px',
          display: 'flex',
          alignItems: 'center',
          borderRadius: '6px',
          opacity: open ? 1 : 0.75,
          transition: 'opacity 0.15s, background 0.15s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f0f0'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
      >
        😊
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            right: 0,
            zIndex: 1000,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
            borderRadius: '12px',
            overflow: 'hidden',
          }}
        >
          {/* Inject compact size overrides for the web component */}
          <style>{PICKER_STYLE}</style>
          <Picker
            data={data}
            onEmojiSelect={handleSelect}
            locale="en"
            theme="light"
            previewPosition="none"
            skinTonePosition="none"
            maxFrequentRows={1}
            perLine={7}
            emojiSize={22}
            emojiButtonSize={30}
          />
        </div>
      )}
    </div>
  );
}
