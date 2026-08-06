"use client";

import { useEffect, useState } from "react";
import Creator from "./Creator";
import Login from "./Login";
import AgentList from "./AgentList";

export default function Page() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [agentId, setAgentId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setLoggedIn(!!data);
        setIsAdmin(!!data?.isAdmin);
      })
      .catch(() => setLoggedIn(false))
      .finally(() => setChecking(false));
  }, []);

  const handleLoginSuccess = () => {
    setLoggedIn(true);
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIsAdmin(!!data?.isAdmin))
      .catch(() => {});
  };

  const logout = () => {
    fetch("/api/logout", { method: "POST" }).finally(() => {
      setLoggedIn(false);
      setAgentId(null);
    });
  };

  if (checking) return null;

  if (!loggedIn) {
    return <Login onSuccess={handleLoginSuccess} />;
  }

  if (agentId === null) {
    return <AgentList onSelect={setAgentId} onLogout={logout} isAdmin={isAdmin} />;
  }

  return <Creator agentId={agentId} onBack={() => setAgentId(null)} />;
}
