/**
 * MigrationExportTool.jsx — Admin utility to export all localStorage data
 * before migrating to the backend API.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

const GALA_KEYS = [
  'gala.users',
  'gala.session',
  'gala.products',
  'gala.orders',
  'gala.chats',
  'gala.reviews',
  'gala.analytics.visits',
  'gala.analytics.productViews',
];

export default function MigrationExportTool() {
  function handleExport() {
    // Collect all present gala.* keys
    const backup = {};
    GALA_KEYS.forEach((key) => {
      const raw = localStorage.getItem(key);
      if (raw !== null && raw !== '') {
        try {
          backup[key] = JSON.parse(raw);
        } catch {
          backup[key] = raw;
        }
      }
    });

    const count = Object.keys(backup).length;
    const bytes = new TextEncoder().encode(JSON.stringify(backup)).length;
    const kb = (bytes / 1024).toFixed(1);

    if (count === 0) {
      alert('Tidak ada data localStorage (gala.*) yang ditemukan untuk diekspor.');
      return;
    }

    const confirmed = window.confirm(
      `Ekspor ${count} key localStorage (${kb} KB)?\n\nFile akan diunduh sebagai gala-backup-${new Date().toISOString().slice(0, 10)}.json`
    );
    if (!confirmed) return;

    try {
      const blob = new Blob([JSON.stringify(backup, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gala-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
      alert(
        'Unduhan gagal. Pastikan browser Anda mengizinkan unduhan dari situs ini, lalu coba lagi.'
      );
    }
  }

  return (
    <div className="migration-export-tool">
      <h3 className="migration-export-title">Export Data localStorage</h3>
      <p className="migration-export-desc">
        Ekspor semua data localStorage (<code>gala.*</code>) ke file JSON sebelum
        beralih ke backend. Jalankan ini sebelum mengaktifkan{' '}
        <code>VITE_USE_BACKEND=true</code>.
      </p>
      <button
        className="adm-btn adm-btn--primary"
        type="button"
        onClick={handleExport}
      >
        📦 Export localStorage Backup
      </button>
    </div>
  );
}
