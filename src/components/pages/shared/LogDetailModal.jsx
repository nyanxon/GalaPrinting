/**
 * LogDetailModal.jsx — Full detail view for a single Activity Log entry.
 *
 * Shows every stored field including the raw `metadata` JSON. Used by the
 * shared ActivityLogSection (admin + owner).
 */

import Modal from '../../ui/Modal.jsx';
import { STAFF_ROLE_CONFIG } from '../../../config/roles.js';

function actorRoleLabel(role) {
  if (!role) return '—';
  return STAFF_ROLE_CONFIG[role]?.label ?? role;
}

/*
 * The API returns `created_at` as a timezone-less WIB (UTC+7) string
 * (server does `created_at + INTERVAL 7 HOUR`). Parse as UTC+7 so the
 * displayed clock time matches the log's real WIB time on any client TZ.
 */
const NAIVE_DT_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/;

function parseLogTime(dateStr) {
  if (!dateStr) return null;
  const d = NAIVE_DT_RE.test(dateStr)
    ? new Date(`${dateStr.replace(' ', 'T')}+07:00`)
    : new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = parseLogTime(dateStr);
  if (!d) return dateStr;
  return d.toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function renderMetadata(metadata) {
  if (metadata === null || metadata === undefined) return <em style={{ color: 'var(--muted)' }}>—</em>;
  if (typeof metadata === 'string') return metadata;
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return String(metadata);
  }
}

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--muted)', marginBottom: 2 }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function LogDetailModal({ log, isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="modal" style={{ width: 'min(92vw, 640px)' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ margin: 0 }}>Detail Log Aktivitas</h2>
          <button className="adm-btn" type="button" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div className="modal-body" style={{ fontSize: 14 }}>
          <Row label="Waktu">
            <span style={{ color: log?.read === false ? 'var(--color-warning-dark)' : 'inherit', fontWeight: log?.read === false ? 700 : 400 }}>
              {fmtDateTime(log?.createdAt)}
            </span>
          </Row>
          <Row label="Aksi">
            <strong>{log?.actionLabel || '—'}</strong>
          </Row>
          <Row label="Aktor">
            {log?.actorName ? (
              <>
                {log.actorName}
                {log.actorRole && <span style={{ color: 'var(--muted)' }}> ({actorRoleLabel(log.actorRole)})</span>}
              </>
            ) : (
              <em style={{ color: 'var(--muted)' }}>anonim</em>
            )}
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Tipe: {log?.actorType || '—'}{log?.actorId ? `  ·  ID: ${log.actorId}` : ''}
            </div>
          </Row>
          <Row label="Target">
            {log?.targetType ? (
              <code>{log.targetType}{log.targetId ? ` · ${log.targetId}` : ''}</code>
            ) : (
              <em style={{ color: 'var(--muted)' }}>—</em>
            )}
          </Row>
          <Row label="Halaman (page path)">
            <code>{log?.pagePath || '—'}</code>
          </Row>
          <Row label="IP Address">
            {log?.ipAddress || <em style={{ color: 'var(--muted)' }}>—</em>}
          </Row>
          <Row label="ID Log">
            <code>{log?.id ?? '—'}</code>
          </Row>
          <Row label="Metadata">
            <pre
              style={{
                background: 'rgba(120, 94, 64, 0.05)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 10,
                fontSize: 12,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
                maxHeight: 260,
                overflow: 'auto',
              }}
            >
              {renderMetadata(log?.metadata)}
            </pre>
          </Row>
        </div>
      </div>
    </Modal>
  );
}
