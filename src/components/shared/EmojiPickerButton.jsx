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
    height: 280px !important;
    max-height: 280px !important;
    width: 260px !important;
    min-width: 260px !important;
    font-size: 13px !important;
  }
  @media (max-width: 480px) {
    em-emoji-picker {
      width: calc(100vw - 48px) !important;
      min-width: unset !important;
      max-width: calc(100vw - 48px) !important;
      height: 260px !important;
      max-height: 260px !important;
    }
  }
`;

export default function EmojiPickerButton({ onEmojiSelect, inputRef }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const [pickerStyle, setPickerStyle] = useState({
    position: 'absolute',
    bottom: '44px',
    right: 0,
    zIndex: 1000,
    boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
    borderRadius: '12px',
    overflow: 'hidden',
  });

  // Recalculate picker position to avoid going off-screen
  useEffect(() => {
    if (!open || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const pickerWidth = window.innerWidth <= 480 ? window.innerWidth - 48 : 260;
    const pickerHeight = window.innerWidth <= 480 ? 260 : 280;

    // Check if picker would overflow to the left
    const wouldOverflowLeft = rect.right - pickerWidth < 8;
    // Check if picker would overflow to the top
    const wouldOverflowTop = rect.top - pickerHeight < 8;

    setPickerStyle({
      position: 'absolute',
      // Place above or below based on available space
      ...(wouldOverflowTop
        ? { top: '44px', bottom: 'auto' }
        : { bottom: '44px', top: 'auto' }),
      // Align left or right based on available space
      ...(wouldOverflowLeft
        ? { left: 0, right: 'auto' }
        : { right: 0, left: 'auto' }),
      zIndex: 1000,
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      borderRadius: '12px',
      overflow: 'hidden',
    });
  }, [open]);

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
    setOpen(false);
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
        <div style={pickerStyle}>
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
