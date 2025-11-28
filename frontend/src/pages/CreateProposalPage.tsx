import { useNavigate } from "react-router-dom";
import { CreateProposal } from "../components/vote/CreateProposal";
import type { ToastVariant } from "../components/ui/Toast";

type CreateProposalPageProps = {
  onCreated?: () => void;
  onNotify?: (toast: { title: string; caption?: string; variant: ToastVariant }) => void;
};

export function CreateProposalPage({ onCreated, onNotify }: CreateProposalPageProps) {
  const navigate = useNavigate();

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="scribble page-title">✨ Create a confidential proposal</p>
        <p className="page-subtitle">
          Define your question, voting options, and schedule. FHedback handles the encryption, tallying, and proofs.
        </p>
      </header>

      <CreateProposal
        onNotify={onNotify}
        onCreated={() => {
          onCreated?.();
          navigate("/proposals");
        }}
      />
    </section>
  );
}

