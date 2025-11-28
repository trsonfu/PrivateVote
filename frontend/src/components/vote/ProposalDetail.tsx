import { useEffect, useMemo, useState } from "react";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { Contract } from "ethers";
import { useZamaInstance } from "../../hooks/useZamaInstance";
import { useEthersSigner } from "../../hooks/useEthersSigner";
import { PRIVATE_VOTE_ABI, PRIVATE_VOTE_ADDRESS } from "../../config/contract";
import { Toast } from "../ui/Toast";

const client = createPublicClient({ chain: sepolia, transport: http() });

type ToastState = {
  title: string;
  caption?: string;
  variant: "success" | "error" | "info";
};

type ProposalMeta = {
  title: string;
  options: readonly string[];
  startTime: bigint;
  endTime: bigint;
  finalized: boolean;
  pending: boolean;
};

function getTimeStatus(timestamp: number, currentTime: number): "upcoming" | "active" | "past" {
  if (timestamp > currentTime) return "upcoming";
  if (timestamp < currentTime) return "past";
  return "active";
}

export function ProposalDetail({ id, meta, onBack }: { id: number; meta: ProposalMeta; onBack: () => void }) {
  const [counts, setCounts] = useState<number[] | null>(null);
  const [voters, setVoters] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState<boolean | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(Math.floor(Date.now() / 1000));
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();
  const [finalized, setFinalized] = useState<boolean>(meta.finalized);
  const [pending, setPending] = useState<boolean>(meta.pending);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    setFinalized(meta.finalized);
    setPending(meta.pending);
  }, [meta.finalized, meta.pending]);

  // Update time every minute so status badges stay fresh
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Math.floor(Date.now() / 1000));
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  const canVote = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return now >= Number(meta.startTime) && now <= Number(meta.endTime) && !finalized;
  }, [meta.endTime, meta.startTime, finalized]);

  const canFinalize = useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    return now > Number(meta.endTime) && !finalized && !pending;
  }, [meta.endTime, finalized, pending]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (finalized) {
          const res = (await client.readContract({
            address: PRIVATE_VOTE_ADDRESS as `0x${string}`,
            abi: PRIVATE_VOTE_ABI,
            functionName: "getResults",
            args: [BigInt(id)],
          })) as readonly (bigint | number)[];
          if (!mounted) return;
          setCounts(Array.from(res).map((x) => Number(x)));
        } else {
          setCounts(null);
        }
        const vc = (await client.readContract({
          address: PRIVATE_VOTE_ADDRESS as `0x${string}`,
          abi: PRIVATE_VOTE_ABI,
          functionName: "getVoterCount",
          args: [BigInt(id)],
        })) as bigint;
        if (!mounted) return;
        setVoters(Number(vc));
      } catch (err) {
        console.warn("Failed to refresh proposal stats", err);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, finalized]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const signer = await signerPromise;
        if (!signer) return;
        const contract = new Contract(PRIVATE_VOTE_ADDRESS, PRIVATE_VOTE_ABI, signer);
        const addr = await signer.getAddress();
        const voted = await contract.hasVoted(id, addr);
        if (!cancelled) {
          setHasVoted(Boolean(voted));
        }
      } catch (err) {
        console.warn("Failed to check hasVoted", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, signerPromise]);

  const vote = async (optionIndex: number) => {
    setError(null);
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error("Connect wallet");
      if (!instance) throw new Error("Encryption not ready");
      setSending(true);
      const c = new Contract(PRIVATE_VOTE_ADDRESS, PRIVATE_VOTE_ABI, signer);
      const buf = instance.createEncryptedInput(PRIVATE_VOTE_ADDRESS, await signer.getAddress());
      buf.add32(optionIndex);
      const encrypted = await buf.encrypt();
      const tx = await c.vote(id, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();
      try {
        const vc = (await client.readContract({
          address: PRIVATE_VOTE_ADDRESS as `0x${string}`,
          abi: PRIVATE_VOTE_ABI,
          functionName: "getVoterCount",
          args: [BigInt(id)],
        })) as bigint;
        setVoters(Number(vc));
      } catch (err) {
        console.warn("Failed to refresh voter count", err);
      }
      setHasVoted(true);
      setToast({
        title: "✅ Vote submitted",
        caption: `Transaction: ${tx.hash.slice(0, 10)}...${tx.hash.slice(-8)}`,
        variant: "success",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setToast({
        title: "❌ Vote failed",
        caption: message,
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  };

  const finalize = async () => {
    setError(null);
    try {
      if ((voters ?? 0) === 0) {
        setToast({
          title: "⚠️ No votes yet",
          caption: "You need at least one vote before finalizing.",
          variant: "info",
        });
        return;
      }
      const signer = await signerPromise;
      if (!signer) throw new Error("Connect wallet");
      if (!instance) throw new Error("Encryption not ready");
      setSending(true);
      const contract = new Contract(PRIVATE_VOTE_ADDRESS, PRIVATE_VOTE_ABI, signer);
      let encryptedCounts: string[] = [];
      try {
        const tx = await contract.requestFinalize(id);
        await tx.wait();
        setPending(true);
      } catch (requestErr: unknown) {
        const lowerMsg = (() => {
          if (typeof requestErr === "object" && requestErr !== null) {
            const shortMessage = (requestErr as { shortMessage?: string }).shortMessage;
            const message = (requestErr as { message?: string }).message;
            return (shortMessage ?? message ?? "").toLowerCase();
          }
          return String(requestErr).toLowerCase();
        })();
        if (lowerMsg.includes("already finalized")) {
          const finalResults = (await contract.getResults(id)) as readonly (bigint | number)[];
          setCounts(Array.from(finalResults).map((x) => Number(x)));
          setFinalized(true);
          setPending(false);
          setToast({
            title: "ℹ️ Already finalized",
            caption: "Results were already available on-chain.",
            variant: "info",
          });
          return;
        }
        if (!lowerMsg.includes("pending")) {
          throw requestErr;
        }
      }

      encryptedCounts = (await contract.getEncryptedCounts(id)) as string[];
      if (!encryptedCounts.length) {
        throw new Error("No encrypted counts found");
      }
      const handles = encryptedCounts.map((h) => h as `0x${string}`);
      const publicDecryptResults = await instance.publicDecrypt(handles);
      const submitTx = await contract.submitDecryption(
        id,
        publicDecryptResults.abiEncodedClearValues,
        publicDecryptResults.decryptionProof,
      );
      await submitTx.wait();

      const orderedCounts = handles.map((handle) => {
        const value = publicDecryptResults.clearValues[handle];
        if (value === undefined) {
          throw new Error("Missing decrypted count for handle");
        }
        if (typeof value === "bigint") {
          return Number(value);
        }
        if (typeof value === "number") {
          return value;
        }
        if (typeof value === "boolean") {
          return value ? 1 : 0;
        }
        return Number(BigInt(value));
      });
      setCounts(orderedCounts);
      setFinalized(true);
      setPending(false);
      setToast({
        title: "✅ Proposal finalized",
        caption: "Public decryption verified on-chain.",
        variant: "success",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setToast({
        title: "❌ Finalize failed",
        caption: message,
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="detail-wrapper">
      <div className="detail-card">
        <div className="detail-header">
          <h3 className="scribble">{meta.title}</h3>
          <div className="detail-header__pills">
            {hasVoted && !finalized && (
              <span className="status-pill voted-pill" aria-label="You have already voted on this proposal">
                ✅ You already voted
              </span>
            )}
            {finalized ? <span className="status-pill finalized">✅ Finalized</span> : null}
          </div>
        </div>

        <div>
          {zamaLoading && <span className="zama-chip zama-chip--loading">Encryption: Initializing…</span>}
          {zamaError && (
            <span className="zama-chip zama-chip--error" title={zamaError}>
              Encryption: Error
            </span>
          )}
          {!zamaLoading && !zamaError && instance && (
            <span className="zama-chip zama-chip--ready">Encryption: Ready</span>
          )}
        </div>

        <div className="detail-meta">
          <div
            className={`detail-meta-item detail-meta-item--time-range detail-meta-item--${getTimeStatus(Number(meta.endTime), currentTime)}`}
          >
            <div className="detail-meta-item__label">⏰ Voting Period</div>
            <div className="detail-meta-time-range">
              <div className="detail-meta-time-range__item">
                <span className="detail-meta-time-range__label">Start</span>
                <span className="detail-meta-time-range__value">
                  {new Date(Number(meta.startTime) * 1000).toLocaleString()}
                </span>
              </div>
              <div className="detail-meta-time-range__item">
                <span className="detail-meta-time-range__label">End</span>
                <span className="detail-meta-time-range__value">
                  {new Date(Number(meta.endTime) * 1000).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
          <div className="detail-meta-item detail-meta-item--stats">
            <div className="detail-meta-item__label">📊 Statistics</div>
            <div className="detail-meta-stats">
              <div className="detail-meta-stats__item">
                <span className="detail-meta-stats__value">{voters ?? "..."}</span>
                <span className="detail-meta-stats__label">Voters</span>
              </div>
            </div>
          </div>
        </div>

        <div className="detail-options">
          {meta.options.map((o: string, i: number) => (
            <div key={i} className="detail-option">
              <div>{o}</div>
              <div className="detail-option__actions">
                {counts != null && <span className="status-pill">{counts[i] ?? 0}</span>}
                <button
                  className="brutal-btn brutal-btn--primary"
                  onClick={() => vote(i)}
                  disabled={!canVote || sending || zamaLoading || !!zamaError || hasVoted}
                >
                  Vote
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="detail-actions">
          <button className="brutal-btn brutal-btn--ghost back-button" onClick={onBack}>
            ← Back to proposals
          </button>

          <div className="detail-actions__right">
            <button
              className="brutal-btn brutal-btn--dark"
              onClick={finalize}
              disabled={!canFinalize || sending || !instance || zamaLoading || !!zamaError}
            >
              Finalize & Verify
            </button>
            {pending && <span className="status-pill pending">Decryption pending…</span>}
          </div>
        </div>

        {error && <div className="alert alert--error">❌ {error}</div>}

        <Toast
          open={Boolean(toast)}
          variant={toast?.variant ?? "info"}
          autoHideMs={5000}
          onClose={() => setToast(null)}
        >
          {toast && (
            <div>
              <div className="toast__title">{toast.title}</div>
              {toast.caption && <div className="toast__caption">{toast.caption}</div>}
            </div>
          )}
        </Toast>
      </div>
    </section>
  );
}
