import { useEffect, useState } from 'react';
import { Contract } from 'ethers';
import { SECRET_VOTE_ABI, SECRET_VOTE_ADDRESS } from '../../config/contract';
import { useEthersSigner } from '../../hooks/useEthersSigner';

declare global {
  interface Window { ethereum?: any }
}

export function CreateProposal() {
  const [title, setTitle] = useState('');
  const [opts, setOpts] = useState<string[]>(['', '']);
  const [startLocal, setStartLocal] = useState<string>('');
  const [endLocal, setEndLocal] = useState<string>('');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const addOption = () => setOpts((o) => [...o, '']);
  const updateOption = (i: number, v: string) => setOpts((o) => o.map((x, idx) => (idx === i ? v : x)));
  const removeOption = (i: number) => setOpts((o) => o.filter((_, idx) => idx !== i));

  useEffect(() => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const toLocalInput = (d: Date) => {
      const y = d.getFullYear();
      const m = pad(d.getMonth() + 1);
      const day = pad(d.getDate());
      const h = pad(d.getHours());
      const min = pad(d.getMinutes());
      return `${y}-${m}-${day}T${h}:${min}`;
    };
    const now = new Date();
    const startD = new Date(now.getTime() + 5 * 60 * 1000);
    const endD = new Date(startD.getTime() + 60 * 60 * 1000);
    setStartLocal(toLocalInput(startD));
    setEndLocal(toLocalInput(endD));
  }, []);

  const toUnix = (local: string): bigint => {
    const ms = new Date(local).getTime();
    return BigInt(Math.floor(ms / 1000));
  };

  const signerPromise = useEthersSigner();

  const submit = async () => {
    setError(null);
    setTxHash(null);
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error('Connect wallet');
      if (!title.trim()) throw new Error('Title required');
      const options = opts.map((s: string) => s.trim()).filter(Boolean);
      if (options.length < 2) throw new Error('At least 2 options');
      if (!startLocal || !endLocal) throw new Error('Start/end required');
      const startTs = toUnix(startLocal);
      const endTs = toUnix(endLocal);

      setSending(true);
      const c = new Contract(SECRET_VOTE_ADDRESS, SECRET_VOTE_ABI, signer);
      const tx = await c.createProposal(title, options, startTs, endTs);
      setTxHash(tx.hash);
      await tx.wait();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="form-card">
      <h2 className="scribble form-title">✨ Create New Proposal</h2>

      <div className="form-field">
        <label className="field-label" htmlFor="proposal-title">📝 Proposal Title</label>
        <input
          id="proposal-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input-field"
          placeholder="Enter a clear and descriptive title"
        />
      </div>

      <div className="form-field">
        <span className="field-label">📋 Voting Options</span>
        {opts.map((o: string, i: number) => (
          <div key={i} className="option-row">
            <input
              value={o}
              onChange={(e) => updateOption(i, e.target.value)}
              className="input-field"
              placeholder={`Option ${i + 1}`}
            />
            {opts.length > 2 && (
              <button
                type="button"
                className="danger-btn"
                onClick={() => removeOption(i)}
                aria-label="Remove option"
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" className="dotted-button" onClick={addOption}>
          + Add Another Option
        </button>
      </div>

      <div className="form-field form-field--split">
        <div>
          <label className="field-label" htmlFor="start-time">🕐 Start Time</label>
          <input
            id="start-time"
            type="datetime-local"
            value={startLocal}
            onChange={(e) => setStartLocal(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="end-time">🕐 End Time</label>
          <input
            id="end-time"
            type="datetime-local"
            value={endLocal}
            onChange={(e) => setEndLocal(e.target.value)}
            className="input-field"
          />
        </div>
      </div>

      <button
        type="button"
        className="brutal-btn brutal-btn--dark brutal-btn--block"
        onClick={submit}
        disabled={sending}
      >
        {sending ? 'Creating Proposal...' : '🚀 Create Proposal'}
      </button>

      {sending && (
        <div className="loading-inline">
          <span className="spinner" aria-hidden="true" />
          <span>Processing transaction on blockchain...</span>
        </div>
      )}

      {txHash && (
        <div className="alert alert--success">
          ✅ Proposal created successfully!
          <div className="alert-caption">Transaction: {txHash.slice(0, 10)}...{txHash.slice(-8)}</div>
        </div>
      )}

      {error && (
        <div className="alert alert--error">
          ❌ {error}
        </div>
      )}
    </section>
  );
}
