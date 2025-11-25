import { useZamaInstance } from '../hooks/useZamaInstance';

export function ZamaStatus() {
  const { instance, isLoading, error } = useZamaInstance();

  if (isLoading) {
    return <span className="zama-chip zama-chip--loading">Encryption: Initializing…</span>;
  }
  if (error) {
    return (
      <span className="zama-chip zama-chip--error" title={error}>
        Encryption: Error
      </span>
    );
  }
  if (instance) {
    return <span className="zama-chip zama-chip--ready">Encryption: Ready</span>;
  }
  return null;
}

