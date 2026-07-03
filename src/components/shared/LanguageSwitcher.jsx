/**
 * LanguageSwitcher.jsx
 *
 * Komponen ganti bahasa: ID | EN | BAL
 * - Format: tombol berteks kode bahasa dengan chevron (▾) di tombol aktif
 * - Layout: pill berisi 3 opsi yang tersegmentasi
 * - Tidak menggunakan dropdown — langsung klik untuk ganti bahasa
 * - Mobile responsive dengan breakpoint navbar
 */

import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'id',  label: 'ID' },
  { code: 'en',  label: 'EN' },
  { code: 'bal', label: 'BAL' },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const active = i18n.language;

  function handleChange(code) {
    if (code !== active) {
      i18n.changeLanguage(code);
    }
  }

  return (
    <div className="lang-switcher" aria-label="Pilih bahasa" role="group">
      {LANGUAGES.map((lang, idx) => (
        <button
          key={lang.code}
          type="button"
          className={`lang-option${lang.code === active ? ' lang-option--active' : ''}${idx === 0 ? ' lang-option--first' : ''}${idx === LANGUAGES.length - 1 ? ' lang-option--last' : ''}`}
          onClick={() => handleChange(lang.code)}
          aria-pressed={lang.code === active}
          aria-label={`Bahasa ${lang.label}`}
        >
          {lang.label}
          {lang.code === active && (
            <span className="lang-chevron" aria-hidden="true">▾</span>
          )}
        </button>
      ))}
    </div>
  );
}

export default LanguageSwitcher;
