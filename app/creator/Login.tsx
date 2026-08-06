"use client";

import { useState } from "react";

export default function Login({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setError("Wrong username or password");
        return;
      }

      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-8">
      <div className="w-[420px] rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-lg">
            🎭
          </div>
          <div>
            <h1 className="text-slate-900 text-xl font-bold">AgentStage Creator</h1>
            <p className="text-slate-500 text-sm">Sign in to continue</p>
          </div>
        </div>

        <form onSubmit={login} className="space-y-5">
          <div>
            <label className="text-sm text-slate-500">Username</label>
            <input
              className="mt-2 w-full rounded-xl bg-white border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-indigo-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="text-sm text-slate-500">Password</label>
            <input
              type="password"
              className="mt-2 w-full rounded-xl bg-white border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-indigo-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            disabled={submitting}
            className="w-full rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 py-3 text-white font-semibold transition-colors"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
