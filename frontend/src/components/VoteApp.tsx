import { useAccount } from "wagmi";
import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Header } from "./Header";
import { Toast, type ToastVariant } from "./ui/Toast";
import { HomePage } from "../pages/HomePage";
import { ViewProposalsPage } from "../pages/ViewProposalsPage";
import { CreateProposalPage } from "../pages/CreateProposalPage";

export function VoteApp() {
  const { isConnected } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);
  const [appToast, setAppToast] = useState<{
    title: string;
    caption?: string;
    variant: ToastVariant;
  } | null>(null);

  return (
    <div className="neo-shell app-shell">
      <Header />
      <main className="brutal-container app-main">
        <Routes>
          <Route path="/" element={<HomePage isConnected={isConnected} />} />
          <Route path="/proposals" element={<ViewProposalsPage refreshKey={refreshKey} />} />
          <Route
            path="/create"
            element={
              <CreateProposalPage
                onCreated={() => setRefreshKey((key) => key + 1)}
                onNotify={(toast) => setAppToast(toast)}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Toast
        open={Boolean(appToast)}
        variant={appToast?.variant ?? "info"}
        autoHideMs={5000}
        onClose={() => setAppToast(null)}
      >
        {appToast && (
          <div>
            <div className="toast__title">{appToast.title}</div>
            {appToast.caption && <div className="toast__caption">{appToast.caption}</div>}
          </div>
        )}
      </Toast>
    </div>
  );
}
