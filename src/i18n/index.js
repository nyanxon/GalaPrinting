/**
 * i18n/index.js
 *
 * Konfigurasi react-i18next untuk Gala Printing.
 * - Default bahasa: Bahasa Indonesia (id)
 * - Deteksi otomatis dari browser / localStorage
 * - Pilihan bahasa tersimpan di localStorage (key: 'galaprintLang')
 * - Fallback ke 'id' jika bahasa tidak dikenali
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import idTranslation from './locales/id/translation.json';
import enTranslation from './locales/en/translation.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      id: { translation: idTranslation },
      en: { translation: enTranslation },
    },
    // Urutan deteksi: localStorage dulu, lalu browser navigator
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'galaprintLang',
      caches: ['localStorage'],
    },
    fallbackLng: 'id',
    supportedLngs: ['id', 'en'],
    interpolation: {
      escapeValue: false, // React sudah aman dari XSS
    },
    // Jangan throw error jika key tidak ditemukan
    saveMissing: false,
    debug: false,
  });

export default i18n;
