import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import App from "./App";
import { AdminPortal } from "./AdminPortal";
import { AuthGate } from "./AuthGate";
import { api, Account } from "./lib/api";
import { UserPortal } from "./UserPortal";
import "./styles.css";

function HostedPortal() {
  const isAdmin = location.pathname.startsWith("/admin");
  const [account, setAccount] = useState<Account | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => { api.me().then(result => setAccount(result.user)).catch(() => setAccount(null)).finally(() => setChecked(true)); }, []);
  if (!checked) return <main className="lock-screen"><div className="lock-card"><span className="brand-mark">M</span><p>جارٍ التحقق من الجلسة…</p></div></main>;
  if (!account || (isAdmin && account.role !== "admin")) return <AuthGate adminOnly={isAdmin} onAuthenticated={setAccount} />;
  return isAdmin ? <AdminPortal admin={account} /> : <UserPortal user={account} />;
}

function Root() {
  const [hasServer, setHasServer] = useState<boolean | null>(location.pathname.startsWith("/admin") ? true : null);
  useEffect(() => {
    if (hasServer !== null) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 1200);
    fetch("/api/health", { signal: controller.signal }).then(response => setHasServer(response.ok)).catch(() => setHasServer(false)).finally(() => window.clearTimeout(timeout));
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [hasServer]);
  if (location.pathname === "/offline" || hasServer === false) return <App />;
  if (hasServer === null) return <main className="lock-screen"><div className="lock-card"><span className="brand-mark">M</span><p>جارٍ تجهيز وضع العمل…</p></div></main>;
  return <HostedPortal />;
}

createRoot(document.getElementById("root")!).render(<StrictMode><Root /></StrictMode>);
