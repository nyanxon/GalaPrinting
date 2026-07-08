/**
 * generate-sounds.mjs — Generate minimal WAV sound files untuk notifikasi.
 * Jalankan: node scripts/generate-sounds.mjs
 * 
 * Menghasilkan 2 file WAV sintetis:
 *   public/sounds/order-new.wav    — 2 nada ascending (new order)
 *   public/sounds/status-change.wav — 1 nada pendek (status change)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '../public/sounds');

// ── WAV writer ──────────────────────────────────────────────────────────────

const SAMPLE_RATE = 22050;

/**
 * Generate WAV buffer dari array of { freq, duration (ms), volume (0-1) }.
 */
function generateWav(notes) {
  const totalSamples = notes.reduce((sum, n) => sum + Math.ceil((n.duration / 1000) * SAMPLE_RATE), 0);
  const dataSize = totalSamples * 2; // 16-bit PCM

  const buf = Buffer.alloc(44 + dataSize);

  // WAV header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);            // PCM subchunk size
  buf.writeUInt16LE(1, 20);             // PCM format
  buf.writeUInt16LE(1, 22);             // Mono
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);             // Block align
  buf.writeUInt16LE(16, 34);            // Bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  let sampleOffset = 44;
  for (const { freq, duration, volume = 0.4 } of notes) {
    const numSamples = Math.ceil((duration / 1000) * SAMPLE_RATE);
    for (let i = 0; i < numSamples; i++) {
      // Sine wave with gentle fade out in last 20% of note
      const fadeStart = numSamples * 0.8;
      const fade = i < fadeStart ? 1.0 : 1.0 - (i - fadeStart) / (numSamples - fadeStart);
      const sample = Math.sin((2 * Math.PI * freq * i) / SAMPLE_RATE) * volume * fade;
      const int16 = Math.max(-32767, Math.min(32767, Math.round(sample * 32767)));
      buf.writeInt16LE(int16, sampleOffset);
      sampleOffset += 2;
    }
  }

  return buf;
}

// ── Sound definitions ─────────────────────────────────────────────────────────

// order-new: 2 ascending notes — friendly "ding dong"
const orderNewNotes = [
  { freq: 880,  duration: 180, volume: 0.45 },  // A5
  { freq: 1047, duration: 220, volume: 0.40 },  // C6
];

// status-change: 1 short soft note
const statusChangeNotes = [
  { freq: 660, duration: 160, volume: 0.35 },   // E5
];

// ── Write files ───────────────────────────────────────────────────────────────

fs.mkdirSync(OUT_DIR, { recursive: true });

const orderNewPath      = path.join(OUT_DIR, 'order-new.wav');
const statusChangePath  = path.join(OUT_DIR, 'status-change.wav');

fs.writeFileSync(orderNewPath, generateWav(orderNewNotes));
fs.writeFileSync(statusChangePath, generateWav(statusChangeNotes));

console.log(`✓ ${orderNewPath}`);
console.log(`✓ ${statusChangePath}`);
console.log('Sound files generated successfully.');
