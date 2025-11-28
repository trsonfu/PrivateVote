import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ProposalList, type ProposalStatusFilter } from "../components/vote/ProposalList";

const filters: { id: ProposalStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "upcoming", label: "Upcoming" },
  { id: "ended", label: "Ended" },
  { id: "finalized", label: "Finalized" },
];

const filterSet = new Set(filters.map((f) => f.id));
const DEFAULT_FILTER: ProposalStatusFilter = "all";

function parseFilter(search: string): ProposalStatusFilter {
  const params = new URLSearchParams(search);
  const status = params.get("status");
  return filterSet.has(status as ProposalStatusFilter) ? (status as ProposalStatusFilter) : DEFAULT_FILTER;
}

type ViewProposalsPageProps = {
  refreshKey: number;
};

export function ViewProposalsPage({ refreshKey }: ViewProposalsPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ProposalStatusFilter>(() => parseFilter(location.search));

  useEffect(() => {
    const nextFilter = parseFilter(location.search);
    setFilter((prev) => (prev === nextFilter ? prev : nextFilter));
  }, [location.search]);

  const handleFilterChange = (next: ProposalStatusFilter) => {
    if (next === filter) return;
    const params = new URLSearchParams(location.search);
    if (next === DEFAULT_FILTER) {
      params.delete("status");
    } else {
      params.set("status", next);
    }
    const search = params.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ""}`);
    setFilter(next);
  };

  return (
    <section className="page-stack">
      <header className="page-header page-header--split">
        <div>
          <p className="scribble page-title">📋 View proposals</p>
          <p className="page-subtitle">Browse every survey, filter by status, and finalize results when voting ends.</p>
        </div>
        <button className="brutal-btn brutal-btn--primary" type="button" onClick={() => navigate("/create")}>
          ✨ Create Proposal
        </button>
      </header>

      <div className="filter-row">
        <span className="filter-label">Filter:</span>
        <div className="filter-pills">
          {filters.map((item) => (
            <button
              key={item.id}
              className={`filter-pill ${filter === item.id ? "active" : ""}`}
              onClick={() => handleFilterChange(item.id)}
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
