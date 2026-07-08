/**
 * useAdminSound.js — Notifikasi suara untuk admin dashboard (Fitur 5).
 *
 * Menangani:
 * - Play sound saat order baru masuk (socket event order:new)
 * - Play sound saat status order berubah (socket event order:status_changed)
 * - Toggle mute/unmute yang disimpan di localStorage
 * - Unlock audio on first user interaction (browser autoplay policy)
 * - Sound berbeda untuk "order baru" vs "perubahan status"
 *
 * Usage:
 *   const { muted, toggleMute, unlockAudio } = useAdminSound(socket);
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const MUTE_KEY = 'gala.admin.sound.muted';

const SOUND_ORDER_NEW     = '/sounds/order-new.wav';
const SOUND_STATUS_CHANGE = '/sounds/status-change.wav';

/**
 * Pre-load audio files and return play functions.
 * Audio object is created lazily on first unlock.
 */
function createSoundPlayer(src) {
  let audio = null;
  let unlocked = false;

  return {
    unlock() {
      if (unlocked) return;
      audio = new Audio(src);
      audio.preload = 'auto';
      // Play a silent fragment to unlock autoplay policy
      audio.volume = 0;
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.volume = 1;
        unlocked = true;
      }).catch(() => {
        // Ignore — will retry on next interaction
        unlocked = false;
      });
    },
    play(muted) {
      if (muted) return;
      if (!audio) {
        audio = new Audio(src);
        audio.preload = 'auto';
      }
      audio.currentTime = 0;
      audio.volume = 0.7;
      audio.play().catch((err) => {
        // Autoplay blocked — normal kalau belum ada interaksi user
        console.warn('[sound] Autoplay blocked:', err.message);
      });
    },
  };
}

/**
 * @param {import('socket.io-client').Socket | null} socket
 * @returns {{ muted: boolean, toggleMute: () => void, unlockAudio: () => void }}
 */
export function useAdminSound(socket) {
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Sound players — stable across renders via ref
  const orderNewPlayer     = useRef(null);
  const statusChangePlayer = useRef(null);

  // Initialise players lazily
  function getPlayers() {
    if (!orderNewPlayer.current)     orderNewPlayer.current     = createSoundPlayer(SOUND_ORDER_NEW);
    if (!statusChangePlayer.current) statusChangePlayer.current = createSoundPlayer(SOUND_STATUS_CHANGE);
    return { orderNewPlayer: orderNewPlayer.current, statusChangePlayer: statusChangePlayer.current };
  }

  /**
   * Unlock audio — harus dipanggil setelah ada interaksi user pertama kali.
   * Otomatis terpanggil saat toggleMute, atau bisa dipanggil manual dari komponen.
   */
  const unlockAudio = useCallback(() => {
    const { orderNewPlayer: onp, statusChangePlayer: scp } = getPlayers();
    onp.unlock();
    scp.unlock();
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      try { localStorage.setItem(MUTE_KEY, String(next)); } catch { /* ignore */ }
      // Saat unmute, unlock audio sekalian
      if (!next) unlockAudio();
      return next;
    });
  }, [unlockAudio]);

  // Daftarkan socket listeners
  useEffect(() => {
    if (!socket) return;

    function handleOrderNew() {
      getPlayers().orderNewPlayer.play(muted);
    }

    function handleStatusChanged() {
      getPlayers().statusChangePlayer.play(muted);
    }

    socket.on('order:new', handleOrderNew);
    socket.on('order:status_changed', handleStatusChanged);

    return () => {
      socket.off('order:new', handleOrderNew);
      socket.off('order:status_changed', handleStatusChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, muted]);

  return { muted, toggleMute, unlockAudio };
}
