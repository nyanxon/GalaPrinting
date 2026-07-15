/**
 * LanguageSwitcher.jsx
 *
 * Dropdown untuk ganti bahasa: ID | EN | BAL
 * - Trigger: tombol bergaya "ID ▾" (kode bahasa aktif + chevron)
 * - Dropdown: daftar pilihan bahasa dengan nama lengkap + checkmark aktif
 * - Close on outside click dan Escape
 * - Mobile responsive
 */

import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from 'react';

const LANGUAGES = [
  { code: 'id',  label: 'ID',  name: 'Indonesia' },
  { code: 'en',  label: 'EN',  name: 'English'   },
  { code: 'bal', label: 'BAL', name: 'Bali'       },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const active = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  function handleSelect(code) {
    i18n.changeLanguage(code);
    setOpen(false);
  }

  // Tutup saat klik di luar
  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Tutup saat Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="lang-switcher" ref={wrapRef}>
      {/* Trigger button */}
      <button
        type="button"
        className={`lang-trigger${open ? ' lang-trigger--open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Pilih bahasa"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
      >
        <span className="lang-trigger-label">{active.label}</span>
        <svg
          className={`lang-trigger-chevron${open ? ' lang-trigger-chevron--up' : ''}`}
          width="10" height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
        >
          <path d="M1.5 3.5L5 7L8.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Dropdown list */}
      {open && (
        <ul
          className="lang-dropdown"
          role="listbox"
          aria-label="Pilih bahasa"
        >
          {LANGUAGES.map((lang) => {
            const isActive = lang.code === i18n.language;
            return (
              <li
                key={lang.code}
                className={`lang-dropdown-item${isActive ? ' lang-dropdown-item--active' : ''}`}
                role="option"
                aria-selected={isActive}
                onClick={() => handleSelect(lang.code)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(lang.code); }}
                tabIndex={0}
              >
                <span className="lang-dropdown-code">{lang.label}</span>
                <span className="lang-dropdown-name">{lang.name}</span>
                {isActive && (
                  <svg className="lang-dropdown-check" width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default LanguageSwitcher;
