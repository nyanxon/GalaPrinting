/**
 * LoadingSpinner — lightweight fallback shown while lazy-loaded routes load.
 * Pure CSS animation, no extra dependencies.
 */
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
          borderTopColor: '#785E40',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
