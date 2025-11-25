import { useCallback, useEffect, useRef, useState } from "react";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { PRIVATE_VOTE_ABI, PRIVATE_VOTE_ADDRESS } from "../../config/contract";
import { ProposalDetail } from "./ProposalDetail";

const client = createPublicClient({ chain: sepolia, transport: http() });

type Meta = {
  title: string;
  options: readonly string[];
  startTime: bigint;
  endTime: bigint;
  finalized: boolean;
  pending: boolean;
  voters: number;
};

export function ProposalList({ refreshKey = 0 }: { refreshKey?: number }) {
  const [count, setCount] = useState<number>(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [metas, setMetas] = useState<Record<number, Meta>>({});
  const [orderedIds, setOrderedIds] = useState<number[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchProposals = useCallback(async () => {
    if (!mountedRef.current) return;
    setLoading(true);
    try {
      const total = (await client.readContract({
        address: PRIVATE_VOTE_ADDRESS as `0x${string}`,
        abi: PRIVATE_VOTE_ABI,
        functionName: 'getProposalCount',
        args: [],
      })) as bigint;
      if (!mountedRef.current) return;
      setCount(Number(total));
      const freshMetas: Record<number, Meta> = {};
      for (let i = 0; i < Number(total); i++) {
        const res = (await client.readContract({
          address: PRIVATE_VOTE_ADDRESS as `0x${string}`,
          abi: PRIVATE_VOTE_ABI,
          functionName: 'getProposal',
          args: [BigInt(i)],
        })) as readonly [string, readonly string[], bigint, bigint, boolean, boolean];
        const voters = (await client.readContract({
          address: PRIVATE_VOTE_ADDRESS as `0x${string}`,
          abi: PRIVATE_VOTE_ABI,
          functionName: 'getVoterCount',
          args: [BigInt(i)],
        })) as bigint;
        freshMetas[i] = {
          title: res[0],
          options: res[1],
          startTime: res[2],
          endTime: res[3],
          finalized: res[4],
          pending: res[5],
          voters: Number(voters),
        };
      }
      if (!mountedRef.current) return;
      const sortedIds = Object.keys(freshMetas)
        .map((id) => Number(id))
        .sort((a, b) => {
          const startA = Number(freshMetas[a]?.startTime ?? 0n);
          const startB = Number(freshMetas[b]?.startTime ?? 0n);
          if (startA === startB) {
            return b - a;
          }
          return startB - startA;
        });
      setMetas(freshMetas);
      setOrderedIds(sortedIds);
      setCount(sortedIds.length);
    } catch (err) {
      console.error('Failed to load proposals', err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals, refreshKey]);

  if (selected != null) {
    return (
      <ProposalDetail
        id={selected}
        meta={metas[selected]!}
        onBack={() => {
          setSelected(null);
          fetchProposals();
        }}
      />
    );
  }

  const getStatusBadge = (meta: Meta) => {
    const now = Date.now() / 1000;
    const startTime = Number(meta.startTime);
    const endTime = Number(meta.endTime);

    if (meta.finalized) {
      return <span className="status-pill finalized">✅ Finalized</span>;
    }
    if (now < startTime) {
      return <span className="status-pill pending">⏳ Pending</span>;
    }
    if (now >= startTime && now <= endTime) {
      return <span className="status-pill active">🗳️ Active</span>;
    }
    return <span className="status-pill ended">⏰ Ended</span>;
  };

  return (
    <section className="proposals-section">
      {loading && (
        <div className="loading-panel">
          <div>🔄 Loading proposals...</div>
          <small>Please wait while we fetch the data</small>
        </div>
      )}

      {!loading && count === 0 && (
        <div className="empty-panel">
          <div className="empty-panel__icon" aria-hidden="true">📋</div>
          <p>No proposals yet. Create the first confidential survey!</p>
        </div>
      )}

      {!loading && count > 0 && (
        <div className="proposal-grid">
          {orderedIds.map((proposalId) => (
            <article
              key={proposalId}
              className="proposal-card"
              onClick={() => setSelected(proposalId)}
            >
              <div className="proposal-card__header">
                <div>
                  <h3 className="proposal-card__title">{metas[proposalId]?.title ?? 'Loading...'}</h3>
                  {metas[proposalId] && getStatusBadge(metas[proposalId])}
                </div>
                <button
                  className="brutal-btn brutal-btn--dark proposal-card__action"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(proposalId);
                  }}
                >
                  View Details
                </button>
              </div>

              <div className="proposal-card__stats">
                <div>📝 {metas[proposalId]?.options?.length ?? 0} options</div>
                <div>👥 {metas[proposalId]?.voters ?? 0} voters</div>
                <div>
                  ⏰ Ends:{' '}
                  {metas[proposalId]?.endTime
                    ? new Date(Number(metas[proposalId].endTime) * 1000).toLocaleDateString()
                    : 'Loading...'}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
