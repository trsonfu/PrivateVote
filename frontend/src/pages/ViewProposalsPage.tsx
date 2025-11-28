import { useState } from "react";
import { Link } from "react-router-dom";
import { ProposalList, type ProposalStatusFilter } from "../components/vote/ProposalList";

const filters: { id: ProposalStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "upcoming", label: "Upcoming" },
  { id: "ended", label: "Ended" },
  { id: "finalized", label: "Finalized" },
];

type ViewProposalsPageProps = {
  refreshKey: number;
};

export function ViewProposalsPage({ refreshKey }: ViewProposalsPageProps) {
  const [filter, setFilter] = useState<ProposalStatusFilter>("all");

  return (
    <section className="page-stack">
      <header className="page-header page-header--split">
        <div>
          <p className="scribble page-title">📋 View proposals</p>
          <p className="page-subtitle">Browse every survey, filter by status, and finalize results when voting ends.</p>
        </div>
        <Link className="brutal-btn brutal-btn--primary" to="/create">
          ✨ Create Proposal
        </Link>
      </header>

      <div className="filter-row">
        <span className="filter-label">Filter:</span>
        <div className="filter-pills">
          {filters.map((item) => (
            <button
              key={item.id}
              className={`filter-pill ${filter === item.id ? "active" : ""}`}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <ProposalList refreshKey={refreshKey} statusFilter={filter} />
    </section>
  );
}

