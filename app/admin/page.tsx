"use client";

import { useEffect, useState } from "react";
import Login from "@/app/creator/Login";

interface Creator {
  id: number;
  username: string;
  is_admin: boolean;
  created_at: string;
  agent_count: number;
}

interface AgentSummary {
  id: number;
  name: string;
  character_name: string | null;
  slug: string;
  updated_at: string;
}

export default function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [creators, setCreators] = useState<Creator[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [selected, setSelected] = useState<Creator | null>(null);
  const [creatorAgents, setCreatorAgents] = useState<AgentSummary[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [allAgents, setAllAgents] = useState<{ id: number; name: string; slug: string; owner_username: string }[]>([]);
  const [defaultSlug, setDefaultSlug] = useState<string>("");
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultSaved, setDefaultSaved] = useState(false);

  const [deletingCreatorId, setDeletingCreatorId] = useState<number | null>(null);
  const [resetPasswordId, setResetPasswordId] = useState<number | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

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

  const loadCreators = () => {
    setLoadingCreators(true);
    fetch("/api/admin/creators")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load creators"))))
      .then(setCreators)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load creators"))
      .finally(() => setLoadingCreators(false));
  };

  useEffect(() => {
    if (loggedIn && isAdmin) loadCreators();
  }, [loggedIn, isAdmin]);

  useEffect(() => {
    if (!(loggedIn && isAdmin)) return;
    fetch("/api/admin/agents")
      .then((r) => (r.ok ? r.json() : []))
      .then(setAllAgents)
      .catch(() => {});
    fetch("/api/settings/default-agent")
      .then((r) => (r.ok ? r.json() : { slug: "" }))
      .then((data) => setDefaultSlug(data.slug ?? ""))
      .catch(() => {});
  }, [loggedIn, isAdmin]);

  const saveDefaultAgent = async () => {
    setSavingDefault(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/default-agent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: defaultSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setDefaultSaved(true);
      setTimeout(() => setDefaultSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingDefault(false);
    }
  };

  const createCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/creators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim(), password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      setNewUsername("");
      setNewPassword("");
      loadCreators();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  const deleteCreator = async (id: number, username: string) => {
    if (!window.confirm(`Delete creator "${username}"? This can't be undone.`)) return;
    setDeletingCreatorId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/creators/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setCreators((prev) => prev.filter((c) => c.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingCreatorId(null);
    }
  };

  const submitResetPassword = async (id: number) => {
    setResettingPassword(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/creators/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPasswordValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Reset failed");
      setResetPasswordId(null);
      setResetPasswordValue("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResettingPassword(false);
    }
  };

  const openCreator = (c: Creator) => {
    setSelected(c);
    setLoadingAgents(true);
    fetch(`/api/admin/creators/${c.id}/agents`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load agents"))))
      .then(setCreatorAgents)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load agents"))
      .finally(() => setLoadingAgents(false));
  };

  const deleteAgent = async (id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? This removes its videos and knowledge files too. This can't be undone.`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      setCreatorAgents((prev) => prev.filter((a) => a.id !== id));
      setCreators((prev) =>
        prev.map((c) => (c.id === selected?.id ? { ...c, agent_count: c.agent_count - 1 } : c))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  if (checking) return null;

  if (!loggedIn) {
    return <Login onSuccess={() => window.location.reload()} />;
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-slate-900 font-medium mb-2">Admin access only</p>
          <p className="text-sm text-slate-500 mb-4">This account doesn't have admin access.</p>
          <a href="/creator" className="text-sm text-indigo-600 hover:underline">
            Go to My Agents →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 p-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Admin Panel</h1>
          <a href="/creator" className="text-sm text-slate-500 hover:text-slate-900">
            ← My Agents
          </a>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Default agent for root URL */}
        <div className="rounded-lg border border-slate-200 p-5">
          <h2 className="font-medium mb-1">Default agent for the root URL</h2>
          <p className="text-sm text-slate-500 mb-3">
            When someone visits the site with no agent link, they'll be sent to this agent.
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[220px]">
              <select
                value={defaultSlug}
                onChange={(e) => setDefaultSlug(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 bg-white"
              >
                <option value="">— None (show generic message) —</option>
                {allAgents.map((a) => (
                  <option key={a.id} value={a.slug}>
                    {a.name} (/{a.slug}) — {a.owner_username}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={saveDefaultAgent}
              disabled={savingDefault}
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
            >
              {savingDefault ? "Saving…" : defaultSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </div>

        {/* Create new creator */}
        <div className="rounded-lg border border-slate-200 p-5">
          <h2 className="font-medium mb-3">Add a new creator</h2>
          <form onSubmit={createCreator} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-slate-500 block mb-1">Username</label>
              <input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                required
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="text-xs text-slate-500 block mb-1">Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={6}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                required
              />
            </div>
            <button
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
            >
              {creating ? "Adding…" : "Add creator"}
            </button>
          </form>
        </div>

        {/* Creators list */}
        <div>
          <h2 className="font-medium mb-3">Creators</h2>
          {loadingCreators ? (
            <p className="text-sm text-slate-500">Loading…</p>
          ) : (
            <div className="grid gap-2">
              {creators.map((c) => (
                <div
                  key={c.id}
                  className={`rounded-lg border transition ${
                    selected?.id === c.id ? "border-indigo-400 bg-slate-50" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2 p-4">
                    <button onClick={() => openCreator(c)} className="text-left flex-1 min-w-0">
                      <p className="font-medium">
                        {c.username} {c.is_admin && <span className="text-xs text-indigo-600 ml-1">(admin)</span>}
                      </p>
                      <p className="text-xs text-slate-500">{c.agent_count} agent{c.agent_count === 1 ? "" : "s"}</p>
                    </button>
                    <button
                      onClick={() => { setResetPasswordId(resetPasswordId === c.id ? null : c.id); setResetPasswordValue(""); }}
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50"
                    >
                      Reset password
                    </button>
                    <button
                      onClick={() => deleteCreator(c.id, c.username)}
                      disabled={deletingCreatorId === c.id || c.is_admin}
                      title={c.is_admin ? "Admin accounts can't be deleted here" : undefined}
                      className="shrink-0 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 disabled:opacity-40"
                    >
                      {deletingCreatorId === c.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>

                  {resetPasswordId === c.id && (
                    <div className="flex gap-2 items-center px-4 pb-4">
                      <input
                        type="password"
                        value={resetPasswordValue}
                        onChange={(e) => setResetPasswordValue(e.target.value)}
                        placeholder="New password (min 6 characters)"
                        minLength={6}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={() => submitResetPassword(c.id)}
                        disabled={resettingPassword || resetPasswordValue.length < 6}
                        className="px-4 py-2 rounded-lg bg-indigo-500 text-white text-sm font-medium hover:bg-indigo-600 disabled:opacity-50"
                      >
                        {resettingPassword ? "Saving…" : "Set password"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected creator's agents */}
        {selected && (
          <div>
            <h2 className="font-medium mb-3">{selected.username}'s agents</h2>
            {loadingAgents ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : creatorAgents.length === 0 ? (
              <p className="text-sm text-slate-500">No agents yet.</p>
            ) : (
              <div className="grid gap-2">
                {creatorAgents.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 p-4 rounded-lg border border-slate-200"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900">{a.name}</p>
                      <p className="text-xs text-indigo-600/70 mt-0.5">/{a.slug}</p>
                    </div>
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
        )}
      </div>
    </div>
  );
}
