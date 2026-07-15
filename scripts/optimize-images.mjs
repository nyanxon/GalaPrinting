/**
 * optimize-images.mjs
 *
 * Converts heavy PNGs to WebP and creates resized variants.
 * Run once after adding/modifying images:
 *   node scripts/optimize-images.mjs
 *
 * Requires: npm install -D sharp (one-time)
 */

import { readdir, stat, rename } from 'fs/promises';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ASSETS_DIR = join(__dirname, '../src/assets');

// Config: [maxWidth, quality]
const WEBP_OPTS = { width: undefined, quality: 80 };

async function convertToWebP(inputPath) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('sharp not installed. Run: npm install -D sharp');
    process.exit(1);
  }

  const outPath = inputPath.replace(/\.png$/i, '.webp');
  const info = await sharp(inputPath)
    .resize({ width: WEBP_OPTS.width, withoutEnlargement: true })
    .webp({ quality: WEBP_OPTS.quality })
    .toFile(outPath);

  const origSize = (await stat(inputPath)).size;
  const newSize = (await stat(outPath)).size;
  const saved = ((1 - newSize / origSize) * 100).toFixed(1);

  console.log(`  ${inputPath} → ${outPath}`);
  console.log(`  ${(origSize / 1024).toFixed(0)}KB → ${(newSize / 1024).toFixed(0)}KB (${saved}% smaller)`);
  return { inputPath, outPath, origSize, newSize };
}

async function main() {
  console.log('Optimizing images in', ASSETS_DIR, '\n');

  const files = await readdir(ASSETS_DIR);
  const pngs = files.filter(f => extname(f).toLowerCase() === '.png');

  if (pngs.length === 0) {
    console.log('No PNG files found.');
    return;
  }

  const results = [];
  for (const file of pngs) {
    const filePath = join(ASSETS_DIR, file);
    const result = await convertToWebP(filePath);
    results.push(result);
  }

  const totalOrig = results.reduce((s, r) => s + r.origSize, 0);
  const totalNew = results.reduce((s, r) => s + r.newSize, 0);
  const totalSaved = ((1 - totalNew / totalOrig) * 100).toFixed(1);

  console.log(`\nTotal: ${(totalOrig / 1024).toFixed(0)}KB → ${(totalNew / 1024).toFixed(0)}KB (${totalSaved}% smaller)`);
  console.log('\nAfter conversion, update imports in the codebase:');
  console.log('  - src/assets/logo.png → src/assets/logo.webp');
  console.log('  - src/assets/register-page.png → src/assets/register-page.webp');
}

main().catch(console.error);
