/**
 * DropZone.jsx — Reusable drag-and-drop file upload zone.
 *
 * Props:
 *   accept        {string}    – native <input> accept string, e.g. "image/*,.pdf"
 *   multiple      {boolean}   – allow multiple files (default false)
 *   maxSize       {number}    – max bytes per file (default 10 MB)
 *   onFiles       {(files: File[]) => void} – called with the accepted files
 *   label         {string}    – primary label text  (default "Klik atau drag file ke sini")
 *   hint          {string}    – secondary hint text (default derived from accept)
 *   disabled      {boolean}
 *   compact       {boolean}   – smaller height, used inline inside forms
 *   className     {string}    – extra CSS class on the root element
 *   children      {ReactNode} – renders inside the zone instead of the default icon+label
 *
 * Usage:
 *   <DropZone accept="image/jpeg,image/png" onFiles={(files) => upload(files[0])} />
 */

import { useState, useRef } from 'react';
import '../../styles/css/shared/dropzone.css';

const DEFAULT_MAX_SIZE = 100 * 1024 * 1024; // 100 MB (updated from 10 MB)

function bytesToMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(0);
}

export default function DropZone({
  accept = '*',
  multiple = false,
  maxSize = DEFAULT_MAX_SIZE,
  onFiles,
  label,
  hint,
  disabled = false,
  compact = false,
  className = '',
  children,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  function validate(fileList) {
    const files = Array.from(fileList);
    const acceptedTypes = accept
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const valid = [];
    const errs = [];

    for (const file of files) {
      if (file.size > maxSize) {
        errs.push(`"${file.name}" terlalu besar (maks. ${bytesToMB(maxSize)} MB).`);
        continue;
      }
      // Type check: allow if accept is '*', or MIME matches, or extension matches
      if (accept !== '*') {
        const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
        const mime = file.type.toLowerCase();
        const ok = acceptedTypes.some((a) => {
          if (a === '*' || a === '*/*') return true;
          if (a.endsWith('/*')) return mime.startsWith(a.replace('/*', '/'));
          if (a.startsWith('.')) return ext === a;
          return mime === a;
        });
        if (!ok) {
          errs.push(`"${file.name}" format tidak didukung.`);
          continue;
        }
      }
      valid.push(file);
    }

    if (errs.length) setError(errs.join(' '));
    else setError('');

    return valid;
  }

  function handleFiles(fileList) {
    if (disabled || !fileList?.length) return;
    const valid = validate(fileList);
    if (valid.length && onFiles) {
      onFiles(multiple ? valid : [valid[0]]);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    if (!disabled) setDragOver(true);
  }

  function handleDragLeave(e) {
    // Only clear if we left the zone entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOver(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleInputChange(e) {
    handleFiles(e.target.files);
    // Reset so the same file can be re-selected
    e.target.value = '';
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  }

  const defaultHint =
    hint ||
    (accept === '*'
      ? `Semua jenis file · Maks. ${bytesToMB(maxSize)} MB`
      : `${accept.replace(/image\//g, '').replace(/application\//g, '').toUpperCase().replace(/,/g, ', ')} · Maks. ${bytesToMB(maxSize)} MB`);

  const rootCls = [
    'dz-root',
    compact ? 'dz-root--compact' : '',
    dragOver ? 'dz-root--over' : '',
    disabled ? 'dz-root--disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootCls}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label || 'Upload file'}
      aria-disabled={disabled}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="dz-input"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleInputChange}
      />

      {children || (
        <div className="dz-body">
          <div className="dz-icon" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="dz-label">{label || (<><strong>Klik</strong> atau <strong>drag &amp; drop</strong> file ke sini</>)}</p>
          <p className="dz-hint">{defaultHint}</p>
        </div>
      )}

      {dragOver && (
        <div className="dz-overlay" aria-hidden="true">
          <div className="dz-overlay-inner">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>Lepaskan untuk upload</span>
          </div>
        </div>
      )}

      {error && (
        <p className="dz-error" role="alert" onClick={(e) => e.stopPropagation()}>
          {error}
        </p>
      )}
    </div>
  );
}
