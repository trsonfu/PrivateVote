import { useAccount } from "wagmi";
import { useEffect, useState } from "react";
import { ProposalList } from "./vote/ProposalList";
import { CreateProposal } from "./vote/CreateProposal";
import { ZamaStatus } from "./ZamaStatus";
import { Header } from "./Header";

const tabs = [
  { id: 'list', label: 'View Proposals', icon: '📋' },
  { id: 'create', label: 'Create Proposal', icon: '✨' }
] as const;

const advantages = [
  {
    icon: '🔒',
    title: 'Absolute Privacy',
    copy: 'Individual answers can never be accessed in plain text.'
  },
  {
    icon: '🛡️',
    title: 'High Security',
    copy: 'End-to-end encryption reduces data breach risks.'
  },
  {
    icon: '📊',
    title: 'Statistical Analysis',
    copy: 'Sum, average, min, max, and frequency on encrypted data.'
  },
  {
    icon: '🌐',
    title: 'Decentralization',
    copy: 'All surveys live on-chain — no single point of failure.'
  },
  {
    icon: '🔍',
    title: 'Transparency',
    copy: 'Open-source smart contracts enable independent audits.'
  },
  {
    icon: '⚡',
    title: 'Zero-Knowledge Proofs',
    copy: 'Validate responses without revealing actual votes.'
  },
] as const;

export function VoteApp() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [refreshKey, setRefreshKey] = useState(0);
  const scrollToSection = (id: string, delay = 0) => {
    setTimeout(() => {
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }, delay);
  };

  useEffect(() => {
    type NavDetail = 'home' | 'view' | 'create';

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<NavDetail>).detail;
      if (detail === 'home') {
        scrollToSection('home');
        return;
      }
      if (detail === 'view') {
        setActiveTab('list');
        scrollToSection('view-proposals', 80);
        return;
      }
      if (detail === 'create') {
        setActiveTab('create');
        scrollToSection('create-proposal', 120);
      }
    };

    window.addEventListener('neo-nav', handler as EventListener);
    return () => {
      window.removeEventListener('neo-nav', handler as EventListener);
    };
  }, []);

  const handleCreateCTA = () => {
    if (isConnected) {
      setActiveTab('create');
      scrollToSection('create-proposal', 120);
    }
  };

  return (
    <div className="neo-shell" id="home">
      <Header />
      <main className="brutal-container app-main">
        <section className="hero">
          <p className="scribble hero-headline">Create Fully Confidential Onchain Surveys</p>
          <p className="hero-subtext">
            Build surveys where every response stays encrypted end-to-end. No identities, no tracking, no data exposure
            — not even the survey owner can access individual answers.
          </p>

          <div className="hero-actions">
            <button className="brutal-btn brutal-btn--dark" onClick={handleCreateCTA}>
              Launch a Confidential Survey →
            </button>
            <button className="brutal-btn brutal-btn--ghost" onClick={() => setActiveTab("list")}>
              Answer Anonymously ↓
            </button>
          </div>

          <div className="hero-footnote">
            <span className="brutal-pill">🔐 Encrypted end-to-end</span>
            <span className="brutal-pill">🧪 Audited Contracts</span>
            <ZamaStatus />
          </div>
        </section>

        <section className="advantages-section" aria-labelledby="advantages-heading">
          <h2 id="advantages-heading" className="scribble advantages-title">
            FHedback Advantages
          </h2>
          <div className="advantages-grid">
            {advantages.map((item) => (
              <article key={item.title} className="adv-card">
                <div className="adv-icon" aria-hidden="true">
                  {item.icon}
                </div>
                <h3 className="adv-title">{item.title}</h3>
                <p className="adv-copy">{item.copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="explore" className="tabs-section">
          <div className="brutal-tabs">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const disabled = tab.id === "create" && !isConnected;
              return (
                <button
                  key={tab.id}
                  className={`brutal-tab ${isActive ? "active" : ""}`}
                  onClick={() => !disabled && setActiveTab(tab.id)}
                  disabled={disabled}
                >
                  {tab.icon} {tab.label}
                </button>
              );
            })}
          </div>

          <div id="surveys" className="tabs-content">
            <div
              id="view-proposals"
              className={`tab-panel ${activeTab === "list" ? "active" : ""}`}
              aria-hidden={activeTab !== "list"}
            >
              <ProposalList refreshKey={refreshKey} />
            </div>
            <div
              id="create-proposal"
              className={`tab-panel ${activeTab === "create" ? "active" : ""}`}
              aria-hidden={activeTab !== "create"}
            >
              <CreateProposal
                onCreated={() => {
                  setRefreshKey((key) => key + 1);
                  setActiveTab("list");
                  scrollToSection("view-proposals", 120);
                }}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
