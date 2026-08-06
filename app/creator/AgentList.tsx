"use client";

import { useEffect, useState } from "react";

interface AgentSummary {
  id: number;
  name: string;
  character_name: string | null;
  slug: string;
  updated_at: string;
}

export default function AgentList({
  onSelect,
  onLogout,
  isAdmin,
}: {
  onSelect: (agentId: number) => void;
  onLogout: () => void;
  isAdmin: boolean;
}) {
  const [agents, setAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/agents")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load agents"))))
      .then((data) => setAgents(data))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load agents"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const createAgent = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Agent" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      onSelect(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const deleteAgent = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? This removes its videos and knowledge files too. This can't be undone.`)) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setAgents((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">My Agents</h1>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <a
                href="/admin"
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:border-slate-400"
              >
                Admin panel
              </a>
            )}
            <button
              onClick={createAgent}
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
            >
              {creating ? "Creating…" : "+ New agent"}
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-500 text-sm hover:border-slate-400 hover:text-slate-900"
            >
              Log out
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : agents.length === 0 ? (
          <p className="text-sm text-slate-500">
            No agents yet. Create your first one to get started.
          </p>
        ) : (
          <div className="grid gap-3">
            {agents.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 p-4 rounded-lg border border-slate-200 hover:border-indigo-400 hover:bg-slate-50 transition"
              >
                <button
                  onClick={() => onSelect(a.id)}
                  className="text-left flex-1 min-w-0"
                >
                  <p className="font-medium text-slate-900">{a.name}</p>
                  <p className="text-xs text-indigo-600/70 mt-0.5">/{a.slug}</p>
                </button>
                <button
                  onClick={() => deleteAgent(a.id, a.name)}
                  disabled={deletingId === a.id}
                  className="shrink-0 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                >
                  {deletingId === a.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
