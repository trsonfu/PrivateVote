import { ConnectButton } from "@rainbow-me/rainbowkit";
import "../styles/Header.css";

type NavTarget = "home" | "view" | "create";

function emitNav(target: NavTarget) {
  window.dispatchEvent(new CustomEvent<NavTarget>("neo-nav", { detail: target }));
}

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

export function Header() {
  return (
    <>
      <header className="nav-bar neo-shell">
        <div className="brutal-container nav-inner">
          <div className="brand-mark">
            <div className="brand-logo scribble">
              F<br />H
            </div>
            <div className="brand-text">
              <div className="brand-title scribble">FHEDBACK</div>
              <span className="brand-subtitle">Confidential Survey</span>
            </div>
          </div>

          <nav className="nav-links" aria-label="Primary navigation">
            <button className="nav-link" type="button" onClick={() => emitNav("home")}>
              🏠 Home
            </button>
            <button className="nav-link" type="button" onClick={() => emitNav("view")}>
              📋 View Proposals
            </button>
            <button className="nav-link" type="button" onClick={() => emitNav("create")}>
              ✨ Create Proposal
            </button>
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
