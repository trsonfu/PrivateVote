import { useEffect, useMemo, useState } from "react";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { Contract } from "ethers";
import { useZamaInstance } from "../../hooks/useZamaInstance";
import { useEthersSigner } from "../../hooks/useEthersSigner";
import { SECRET_VOTE_ABI, SECRET_VOTE_ADDRESS } from "../../config/contract";

const client = createPublicClient({ chain: sepolia, transport: http() });

export function ProposalDetail({ id, meta, onBack }: { id: number; meta: any; onBack: () => void }) {
  const [counts, setCounts] = useState<number[] | null>(null);
  const [voters, setVoters] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();
  const [finalized, setFinalized] = useState<boolean>(meta.finalized);
  const [pending, setPending] = useState<boolean>(meta.pending);

  useEffect(() => {
    setFinalized(meta.finalized);
    setPending(meta.pending);
  }, [meta.finalized, meta.pending]);

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
            address: SECRET_VOTE_ADDRESS as `0x${string}`,
            abi: SECRET_VOTE_ABI,
            functionName: "getResults",
            args: [BigInt(id)],
          })) as readonly (bigint | number)[];
          if (!mounted) return;
          setCounts(Array.from(res).map((x) => Number(x)));
        } else {
          setCounts(null);
        }
        const vc = (await client.readContract({
          address: SECRET_VOTE_ADDRESS as `0x${string}`,
          abi: SECRET_VOTE_ABI,
          functionName: "getVoterCount",
          args: [BigInt(id)],
        })) as bigint;
        if (!mounted) return;
        setVoters(Number(vc));
      } catch {
        // ignore network errors here
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id, finalized]);

  const vote = async (optionIndex: number) => {
    setError(null);
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error("Connect wallet");
      if (!instance) throw new Error("Encryption not ready");
      setSending(true);
      const c = new Contract(SECRET_VOTE_ADDRESS, SECRET_VOTE_ABI, signer);
      const buf = instance.createEncryptedInput(SECRET_VOTE_ADDRESS, await signer.getAddress());
      buf.add32(optionIndex);
      const encrypted = await buf.encrypt();
      const tx = await c.vote(id, encrypted.handles[0], encrypted.inputProof);
      await tx.wait();
      try {
        const vc = (await client.readContract({
          address: SECRET_VOTE_ADDRESS as `0x${string}`,
          abi: SECRET_VOTE_ABI,
          functionName: "getVoterCount",
          args: [BigInt(id)],
        })) as bigint;
        setVoters(Number(vc));
      } catch {}
      alert("Voted");
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  const finalize = async () => {
    setError(null);
    try {
      const signer = await signerPromise;
      if (!signer) throw new Error("Connect wallet");
      if (!instance) throw new Error("Encryption not ready");
      setSending(true);
      const contract = new Contract(SECRET_VOTE_ADDRESS, SECRET_VOTE_ABI, signer);
      let encryptedCounts: string[] = [];
      try {
        const tx = await contract.requestFinalize(id);
        await tx.wait();
        setPending(true);
      } catch (requestErr: any) {
        const message = (requestErr?.shortMessage ?? requestErr?.message ?? "").toLowerCase();
        if (message.includes("already finalized")) {
          const finalResults = (await contract.getResults(id)) as readonly (bigint | number)[];
          setCounts(Array.from(finalResults).map((x) => Number(x)));
          setFinalized(true);
          setPending(false);
          alert("Proposal already finalized on-chain.");
          return;
        }
        if (!message.includes("pending")) {
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
      alert("Đã giải mã công khai và xác minh kết quả.");
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="detail-wrapper">
      <div className="detail-card">
        <div className="detail-header">
          <h3 className="scribble">{meta.title}</h3>
          {finalized ? <span className="status-pill finalized">✅ Finalized</span> : null}
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
          Start: {new Date(Number(meta.startTime) * 1000).toLocaleString()} • End:{" "}
          {new Date(Number(meta.endTime) * 1000).toLocaleString()} • Voters: {voters ?? "..."}
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
                  disabled={!canVote || sending || zamaLoading || !!zamaError}
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
      </div>
    </section>
  );
}
