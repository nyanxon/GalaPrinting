/**
 * LanguageSwitcher.jsx
 *
 * Komponen untuk ganti bahasa (ID ⇄ EN).
 * - Menampilkan toggle/dropdown bahasa dengan flag emoji
 * - Menyimpan pilihan di localStorage via i18next
 * - Mengubah <html lang> secara otomatis
 * - Style minimal yang menyatu dengan navbar
 */

import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from 'react';

const LANGUAGES = [
  { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const currentLang = LANGUAGES.find((l) => l.code === i18n.language) || LANGUAGES[0];

  function handleChange(code) {
    i18n.changeLanguage(code);
    setOpen(false);
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="lang-switcher" ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        className="lang-switcher-btn"
        type="button"
        aria-label="Change language"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        <span className="lang-flag">{currentLang.flag}</span>
        <span className="lang-code">{currentLang.code.toUpperCase()}</span>
        <span className="lang-arrow">▾</span>
      </button>

      {open && (
        <div className="lang-dropdown" role="listbox" aria-label="Select language">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              className={`lang-dropdown-item${lang.code === i18n.language ? ' active' : ''}`}
              type="button"
              role="option"
              aria-selected={lang.code === i18n.language}
              onClick={() => handleChange(lang.code)}
            >
              <span className="lang-flag">{lang.flag}</span>
              <span className="lang-label">{lang.label}</span>
              {lang.code === i18n.language && <span className="lang-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
