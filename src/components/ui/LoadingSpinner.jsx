/**
 * LoadingSpinner — lightweight fallback shown while lazy-loaded routes load.
 * Pure CSS animation, no extra dependencies.
 */
import { BRAND_COLOR } from '../../config/brand.js';

export default function LoadingSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f6efe2',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '4px solid #e0d5c5',
          borderTopColor: BRAND_COLOR,
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
