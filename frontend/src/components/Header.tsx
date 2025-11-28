import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../styles/Header.css";

function WalletAction() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        if (!connected) {
          return (
            <button className="brutal-btn brutal-btn--dark" onClick={openConnectModal}>
              Connect Wallet
            </button>
          );
        }

        if (chain?.unsupported) {
          return (
            <button className="brutal-btn brutal-btn--primary" onClick={openChainModal}>
              Switch Network
            </button>
          );
        }

        return (
          <button className="brutal-btn brutal-btn--primary" onClick={openAccountModal}>
            {account?.displayName}
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}

const primaryLinks = [
  { path: "/", label: "🏠 Home", exact: true },
  { path: "/proposals", label: "📋 View Proposals" },
  { path: "/create", label: "✨ Create Proposal" },
] as const;

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActivePath = (path: string, exact?: boolean) => {
    if (exact) {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <header className="nav-bar neo-shell">
        <div className="brutal-container nav-inner">
          <Link to="/" className="brand-mark">
            <div className="brand-logo scribble">
              F<br />H
            </div>
            <div className="brand-text">
              <div className="brand-title scribble">FHEDBACK</div>
              <span className="brand-subtitle">Confidential Survey</span>
            </div>
          </Link>

          <nav className="nav-links" aria-label="Primary navigation">
            {primaryLinks.map((link) => (
              <button
                key={link.path}
                type="button"
                className={`nav-link ${isActivePath(link.path, link.exact) ? "active" : ""}`}
                onClick={() => navigate(link.path)}
              >
                {link.label}
              </button>
            ))}
          </nav>

          <div className="nav-actions">
            <WalletAction />
          </div>
        </div>
      </header>

      <div className="network-badge brutal-pill">🌀 FHEVM Testnet</div>
    </>
  );
}
