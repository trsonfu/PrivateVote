import { useNavigate } from "react-router-dom";
import { ZamaStatus } from "../components/ZamaStatus";

type HomePageProps = {
  isConnected: boolean;
};

const advantages = [
  { icon: "🔒", title: "Absolute Privacy", copy: "Individual answers stay encrypted end-to-end." },
  { icon: "🛡️", title: "High Security", copy: "No raw ballots ever touch centralized servers." },
  { icon: "📊", title: "Encrypted Analytics", copy: "Run sum, average, min, max on ciphertexts." },
  { icon: "🌐", title: "Decentralized", copy: "Smart contracts ensure no single point of failure." },
  { icon: "🔍", title: "Transparent", copy: "Open-source contracts enable independent audits." },
  { icon: "⚡", title: "ZK Validated", copy: "Zero-knowledge proofs guarantee vote integrity." },
] as const;

export function HomePage({ isConnected }: HomePageProps) {
  const navigate = useNavigate();

  const handleCreateClick = () => {
    navigate("/create");
  };

  const handleViewClick = () => {
    navigate("/proposals");
  };

  return (
    <>
      <section className="hero">
        <p className="scribble hero-headline">Create Fully Confidential Onchain Surveys</p>
        <p className="hero-subtext">
          Build surveys where every response stays encrypted end-to-end. No identities, no tracking, no data exposure —
          not even the survey owner can access individual answers.
        </p>

        <div className="hero-actions">
          <button className="brutal-btn brutal-btn--dark" onClick={handleCreateClick}>
            Launch a Confidential Survey →
          </button>
          <button className="brutal-btn brutal-btn--ghost" onClick={handleViewClick}>
            Answer Anonymously ↓
          </button>
        </div>

        <div className="hero-footnote">
          <span className="brutal-pill">🔐 Encrypted end-to-end</span>
          <span className="brutal-pill">🧪 Audited Contracts</span>
          <ZamaStatus />
        </div>
      </section>

      <section className="home-create-callout">
        <div>
          <p className="scribble callout-title">Ready to launch a new proposal?</p>
          <p className="callout-copy">
            Craft a question, add voting options, schedule the window, and FHedback keeps every ballot private using FHE.
          </p>
        </div>
        <button className="brutal-btn brutal-btn--primary" onClick={handleCreateClick} disabled={!isConnected}>
          {isConnected ? "Create Proposal" : "Connect Wallet to Create"}
        </button>
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
    </>
  );
}

