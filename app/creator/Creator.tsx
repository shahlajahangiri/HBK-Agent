"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import QRCode from "qrcode";
import type { Scene, VideoClip } from "@/lib/scene";
import { scene as defaultScene } from "@/lib/scene";

// ─── Types ────────────────────────────────────────────────────────────────────

type NavSection = "scene" | "character" | "videos" | "share";

interface TestResult {
  reply: string;
  expected: number | null;
  got: number | null;
  ok: boolean | null;
  loading: boolean;
}

const STORAGE_KEY = "agentStageScene";

// ─── Shared primitives ────────────────────────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500 leading-relaxed">{hint}</p>}
    </div>
  );
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 focus:bg-slate-100 w-full transition-colors"
    />
  );
}

function Textarea({
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="bg-slate-100 border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 focus:bg-slate-100 w-full resize-none transition-colors leading-relaxed"
    />
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onChange}
      className="flex items-center gap-3 group"
      role="switch"
      aria-checked={checked}
    >
      <div
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${checked ? "bg-indigo-500" : "bg-slate-200"}`}
      >
        <div
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${checked ? "left-6" : "left-1"}`}
        />
      </div>
      <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">
        {label}
      </span>
    </button>
  );
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({
  id,
  label,
  icon,
  active,
  onClick,
  done,
}: {
  id: NavSection;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  done: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
        active
          ? "bg-indigo-500/15 text-indigo-600 border border-indigo-500/20"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-200"
      }`}
    >
      <span
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          active
            ? "bg-indigo-500/20 text-indigo-600"
            : "bg-slate-100 text-slate-500 group-hover:bg-slate-300 group-hover:text-slate-900"
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 text-left">{label}</span>
      {done && (
        <svg
          className="w-4 h-4 text-emerald-600 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      )}
    </button>
  );
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

// ─── Scene section ────────────────────────────────────────────────────────────

function SectionScene({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (s: Scene) => void;
}) {
  return (
    <SectionCard title="Scene" subtitle="The core identity of this experience.">
      <Field label="Scene name" hint="Internal label — not shown to visitors.">
        <Input
          value={scene.name}
          onChange={(e) => onChange({ ...scene, name: e.target.value })}
          placeholder="e.g. HBK Exhibition Guide"
        />
      </Field>

      <Field
        label="Knowledge & system prompt"
        hint="Upload a .txt file to fill this in, then fine-tune by typing below if needed. Uploading again will ask before replacing what's here. Keep replies short — this is a voice conversation."
      >
        <TxtUploadZone
          currentValue={scene.systemPrompt}
          onLoaded={(text) => onChange({ ...scene, systemPrompt: text })}
        />
        <Textarea
          rows={6}
          value={scene.systemPrompt}
          onChange={(e) => onChange({ ...scene, systemPrompt: e.target.value })}
          placeholder="You are Mira, a friendly guide at…"
        />
      </Field>

      <Field
        label="Idle message"
        hint="Shown before the visitor says anything."
      >
        <Input
          value={scene.idleMessage}
          onChange={(e) => onChange({ ...scene, idleMessage: e.target.value })}
          placeholder="Hi! Ask me anything about the exhibition."
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Display orientation">
          <div className="flex gap-2">
            {(["portrait", "landscape", "auto"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onChange({ ...scene, orientation: mode })}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-medium transition-all ${
                  scene.orientation === mode
                    ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-600"
                    : "bg-slate-100 border-slate-300 text-slate-500 hover:border-slate-400"
                }`}
              >
                <span className="text-lg">
                  {mode === "portrait"
                    ? "📱"
                    : mode === "landscape"
                      ? "🖥️"
                      : "✨"}
                </span>
                <span className="capitalize">
                  {mode === "auto" ? "Auto" : mode}
                </span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="Display options">
          <div className="flex flex-col gap-3 justify-center h-full pt-1">
            <Toggle
              checked={scene.showBotText}
              onChange={() =>
                onChange({ ...scene, showBotText: !scene.showBotText })
              }
              label="Show reply as text"
            />
          </div>
        </Field>
      </div>
    </SectionCard>
  );
}

// ─── Character section ────────────────────────────────────────────────────────

function SectionCharacter({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (s: Scene) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Character" subtitle="Name and video selection logic.">
        <Field label="Character name">
          <Input
            value={scene.characterName}
            onChange={(e) =>
              onChange({ ...scene, characterName: e.target.value })
            }
            placeholder="Mira"
          />
        </Field>
      </SectionCard>

      <VoicePicker scene={scene} onChange={onChange} />
    </div>
  );
}

// ─── Voice picker (ElevenLabs Voice Library) ──────────────────────────────────

interface RemoteVoice {
  voiceId: string;
  name: string;
  gender: string;
  accent: string;
  language: string;
  description: string;
  previewUrl: string;
}

function VoicePicker({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (s: Scene) => void;
}) {
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("any");
  const [accent, setAccent] = useState("any");
  const [language, setLanguage] = useState("any");
  const [voices, setVoices] = useState<RemoteVoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const fetchVoices = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (gender !== "any") params.set("gender", gender);
    if (accent !== "any") params.set("accent", accent);
    if (language !== "any") params.set("language", language);

    fetch(`/api/voices?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setVoices(data.voices ?? []);
      })
      .catch(() => setError("Could not load voices from ElevenLabs."))
      .finally(() => setLoading(false));
  }, [search, gender, accent, language]);

  useEffect(() => {
    const t = setTimeout(fetchVoices, 400);
    return () => clearTimeout(t);
  }, [fetchVoices]);

  const playPreview = (voice: RemoteVoice) => {
    audioRef.current?.pause();
    if (playingId === voice.voiceId) {
      setPlayingId(null);
      return;
    }
    if (!voice.previewUrl) return;
    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;
    audio.play();
    setPlayingId(voice.voiceId);
    audio.onended = () => setPlayingId(null);
  };

  const selectVoice = (voice: RemoteVoice) => {
    onChange({ ...scene, voiceId: voice.voiceId, voiceName: voice.name });
  };

  return (
    <SectionCard
      title="Voice"
      subtitle="Choose from ElevenLabs' full voice library — any gender, accent, or language."
    >
      {scene.voiceName && (
        <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/30 rounded-xl px-4 py-3">
          <div>
            <p className="text-xs text-indigo-600 mb-0.5">Current voice</p>
            <p className="text-sm text-slate-900 font-medium">{scene.voiceName}</p>
          </div>
          <button
            onClick={() => onChange({ ...scene, voiceId: undefined, voiceName: undefined })}
            className="text-xs text-slate-500 hover:text-slate-900 transition-colors"
          >
            Reset to default
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search voices by name or description…"
          className="w-full text-sm text-slate-900 bg-slate-100 border border-slate-300 rounded-xl px-4 py-3 outline-none focus:border-indigo-500"
        />
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="flex-1 text-sm text-slate-900 bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
          >
            <option value="any">Any gender</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="neutral">Neutral</option>
          </select>
          <select
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="flex-1 text-sm text-slate-900 bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
          >
            <option value="any">Any accent</option>
            <option value="american">American</option>
            <option value="british">British</option>
            <option value="german">German</option>
            <option value="australian">Australian</option>
            <option value="indian">Indian</option>
            <option value="african">African</option>
          </select>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="flex-1 text-sm text-slate-900 bg-slate-100 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
          >
            <option value="any">Any language</option>
            <option value="en">English</option>
            <option value="de">German</option>
          </select>
        </div>
      </div>

      {loading && <p className="text-xs text-slate-500">Loading voices…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
        {voices.map((v) => (
          <div
            key={v.voiceId}
            className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border transition-colors ${
              scene.voiceId === v.voiceId
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-slate-300 bg-slate-50"
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm text-slate-900 font-medium truncate">{v.name}</p>
              <p className="text-xs text-slate-500 truncate">
                {v.gender} · {v.accent} · {v.language}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => playPreview(v)}
                disabled={!v.previewUrl}
                className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 hover:border-slate-400 flex items-center justify-center text-slate-700 hover:text-slate-900 disabled:opacity-30 transition-colors"
                aria-label="Preview voice"
              >
                {playingId === v.voiceId ? "⏸" : "▶"}
              </button>
              <button
                onClick={() => selectVoice(v)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  scene.voiceId === v.voiceId
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-100 border border-slate-300 text-slate-700 hover:text-slate-900 hover:border-slate-400"
                }`}
              >
                {scene.voiceId === v.voiceId ? "Selected" : "Select"}
              </button>
            </div>
          </div>
        ))}
        {!loading && voices.length === 0 && !error && (
          <p className="text-xs text-slate-500">No voices found. Try a different search or filter.</p>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Video upload zone ────────────────────────────────────────────────────────

// ─── Knowledge/system-prompt .txt upload zone ─────────────────────────────────

function TxtUploadZone({
  currentValue,
  onLoaded,
}: {
  currentValue: string;
  onLoaded: (text: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedName, setLoadedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".txt")) {
        setError("Only .txt files are supported");
        return;
      }
      // Uploading replaces the whole field — warn before wiping out existing content
      // (typed manually or from a previous upload) instead of silently overwriting it.
      if (currentValue.trim()) {
        const confirmed = window.confirm(
          "This will replace the current text below with the uploaded file's content. Continue?",
        );
        if (!confirmed) return;
      }
      setError(null);
      try {
        const text = await file.text();
        onLoaded(text);
        setLoadedName(file.name);
      } catch {
        setError("Could not read that file");
      }
    },
    [onLoaded, currentValue],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) load(file);
    },
    [load],
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-3 text-center transition-all duration-200 ${
        dragOver
          ? "border-indigo-400/60 bg-indigo-500/10 scale-[1.01]"
          : "border-slate-300 hover:border-slate-400 hover:bg-slate-100"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) load(f);
        }}
      />
      <p className="text-xs text-slate-500">
        {loadedName ? (
          <>Loaded <span className="text-slate-900 font-medium">{loadedName}</span> — drop another .txt to replace</>
        ) : (
          "Drop a .txt file here or click to browse"
        )}
      </p>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

// ─── Video upload zone ────────────────────────────────────────────────────────

function VideoUploadZone({
  clipIndex,
  onUploaded,
}: {
  clipIndex: number;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("video/")) {
        setError("Only video files allowed");
        return;
      }
      setUploading(true);
      setError(null);
      setProgress(0);

      // Fake progress bar while uploading (XHR doesn't easily work with app router)
      const interval = setInterval(
        () => setProgress((p) => Math.min(p + 8, 85)),
        200,
      );

      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        clearInterval(interval);
        setProgress(100);
        setTimeout(() => {
          onUploaded(data.url);
          setProgress(0);
        }, 400);
      } catch (e) {
        clearInterval(interval);
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) upload(file);
    },
    [upload],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => !uploading && inputRef.current?.click()}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-all duration-200 ${
        dragOver
          ? "border-indigo-400/60 bg-indigo-500/10 scale-[1.01]"
          : "border-slate-300 hover:border-slate-400 hover:bg-slate-100"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />

      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-slate-500">Uploading…</p>
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center mb-1">
            <svg
              className="w-4 h-4 text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>
          <p className="text-xs font-medium text-slate-700">Drop video here</p>
          <p className="text-xs text-slate-500">or click to browse</p>
        </div>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

// ─── Videos section ───────────────────────────────────────────────────────────

function SectionVideos({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (s: Scene) => void;
}) {
  const [testReply, setTestReply] = useState("");
  const [testExpected, setTestExpected] = useState<string>("");
  const [results, setResults] = useState<TestResult[]>([]);
  const [testing, setTesting] = useState(false);

  const addVideo = useCallback(() => {
    const next = scene.videos.length + 1;
    onChange({
      ...scene,
      videos: [
        ...scene.videos,
        { index: next, url: "", label: `Clip ${next}` },
      ],
    });
  }, [scene, onChange]);

  const removeVideo = useCallback(
    (index: number) => {
      const filtered = scene.videos
        .filter((v) => v.index !== index)
        .map((v, i) => ({ ...v, index: i + 1 }));
      onChange({ ...scene, videos: filtered });
    },
    [scene, onChange],
  );

  const updateVideo = useCallback(
    (index: number, field: keyof VideoClip, value: string | number | boolean) => {
      onChange({
        ...scene,
        videos: scene.videos.map((v) =>
          v.index === index ? { ...v, [field]: value } : v,
        ),
      });
    },
    [scene, onChange],
  );

  const runTest = useCallback(async () => {
    if (!testReply.trim()) return;
    setTesting(true);
    const expected = testExpected ? parseInt(testExpected) : null;
    try {
      const res = await fetch("/api/select-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botReply: testReply }),
      });
      const data = await res.json();
      const got = data.videoIndex as number;
      setResults((prev) => [
        {
          reply: testReply,
          expected,
          got,
          ok: expected !== null ? got === expected : null,
          loading: false,
        },
        ...prev.slice(0, 9),
      ]);
    } catch {
      setResults((prev) => [
        { reply: testReply, expected, got: null, ok: false, loading: false },
        ...prev.slice(0, 9),
      ]);
    }
    setTesting(false);
  }, [testReply, testExpected]);

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Video Clips"
        subtitle="Upload one video per emotion or topic. The AI picks the right one automatically."
      >
        <div className="flex flex-col gap-3">
          {scene.videos.map((v) => (
            <div
              key={v.index}
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-4 items-start"
            >
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-600 shrink-0 mt-0.5">
                {v.index}
              </div>
              <div className="flex flex-col gap-2 flex-1 min-w-0">
                <Input
                  value={v.label}
                  onChange={(e) =>
                    updateVideo(v.index, "label", e.target.value)
                  }
                  placeholder="Label (e.g. Explaining)"
                />
                <Textarea
                  rows={2}
                  value={v.description ?? ""}
                  onChange={(e) =>
                    updateVideo(v.index, "description", e.target.value)
                  }
                  placeholder="Describe when to use this clip — the AI reads this to pick the right video. E.g. 'Use when explaining an artwork, technique, or material in detail.'"
                />
                {v.url ? (
                  <div className="relative group rounded-xl overflow-hidden">
                    <video
                      src={v.url}
                      className="w-full h-28 object-cover bg-black"
                      muted
                      onMouseEnter={(e) =>
                        (e.currentTarget as HTMLVideoElement).play()
                      }
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLVideoElement).pause();
                        (e.currentTarget as HTMLVideoElement).currentTime = 0;
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <button
                        onClick={() => updateVideo(v.index, "url", "")}
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-500/80 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium"
                      >
                        Replace
                      </button>
                    </div>
                  </div>
                ) : (
                  <VideoUploadZone
                    clipIndex={v.index}
                    onUploaded={(url) => updateVideo(v.index, "url", url)}
                  />
                )}
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button
                  onClick={() =>
                    onChange({ ...scene, idleVideoIndex: v.index })
                  }
                  title="Set as idle/default video"
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-xs font-bold ${
                    scene.idleVideoIndex === v.index
                      ? "bg-indigo-500/30 text-indigo-600 border border-indigo-500/40"
                      : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-500/10"
                  }`}
                  aria-label="Set as idle video"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => updateVideo(v.index, "muted", !v.muted)}
                  title={v.muted ? "Muted — click to allow sound" : "Sound on — click to mute"}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-xs font-bold ${
                    v.muted
                      ? "bg-red-500/15 text-red-600 border border-red-500/30"
                      : "text-slate-600 hover:text-indigo-600 hover:bg-indigo-500/10"
                  }`}
                  aria-label={v.muted ? "Unmute this clip" : "Mute this clip"}
                >
                  {v.muted ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => removeVideo(v.index)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:text-red-600 hover:bg-red-500/10 transition-colors"
                  aria-label="Remove clip"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}

          <p className="text-xs text-slate-600 px-1">
            Click{" "}
            <svg
              className="w-3 h-3 inline mb-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
              />
            </svg>{" "}
            on a clip to set it as the idle video — it loops until the visitor
            speaks.
          </p>

          <button
            onClick={addVideo}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Add clip
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Selector Tester"
        subtitle="Type a sample bot reply to check which clip the AI would pick."
      >
        <Textarea
          rows={3}
          value={testReply}
          onChange={(e) => setTestReply(e.target.value)}
          placeholder="This artwork was created using recycled materials and sound sensors…"
        />
        <div className="flex gap-2 items-center">
          <Input
            value={testExpected}
            onChange={(e) => setTestExpected(e.target.value)}
            placeholder="Expected clip #"
            type="number"
            min={1}
            max={scene.videos.length}
            style={{ maxWidth: 140 }}
          />
          <button
            onClick={runTest}
            disabled={testing || !testReply.trim()}
            className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
          >
            {testing ? "Testing…" : "Run test"}
          </button>
        </div>
        {results.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              Recent results
            </p>
            {results.map((r, i) => (
              <div
                key={i}
                className="bg-slate-100 rounded-xl px-4 py-3 flex items-center gap-3 text-sm"
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    r.ok === true
                      ? "bg-emerald-500/20 text-emerald-600"
                      : r.ok === false
                        ? "bg-red-500/20 text-red-600"
                        : "bg-slate-200 text-slate-500"
                  }`}
                >
                  {r.got ?? "?"}
                </span>
                <span className="text-slate-500 truncate flex-1 text-xs">
                  {r.reply}
                </span>
                {r.ok === false && (
                  <span className="text-xs text-red-600 shrink-0">
                    expected {r.expected}
                  </span>
                )}
                {r.ok === true && (
                  <span className="text-xs text-emerald-600 shrink-0">
                    ✓ correct
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─── Share section ────────────────────────────────────────────────────────────

function SectionShare({ scene }: { scene: Scene }) {
  const slug =
    scene.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "my-scene";
  // share the live site itself — the visitor page is at the root
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(window.location.origin + "/"); }, []);
  const embedCode = `<iframe src="${url}" width="420" height="720" allow="microphone" frameborder="0"></iframe>`;
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 512, margin: 2 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [url]);

  const downloadQr = () => {
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${slug}-qr.png`;
    a.click();
  };

  const copy = (text: string, which: "url" | "embed") => {
    navigator.clipboard.writeText(text).then(() => {
      if (which === "url") {
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2000);
      } else {
        setCopiedEmbed(true);
        setTimeout(() => setCopiedEmbed(false), 2000);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <SectionCard
        title="Scene summary"
        subtitle="Overview of your current configuration."
      >
        <div className="grid grid-cols-2 gap-3">
          {[
            ["Character", scene.characterName || "—"],
            ["Clips", `${scene.videos.length} videos`],
            ["Orientation", scene.orientation],
            ["Bot text", scene.showBotText ? "Visible" : "Hidden"],
            ["Slug", slug],
            ["Status", scene.slug ? "Saved to DB" : "Not saved yet"],
          ].map(([k, v]) => (
            <div key={k} className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 mb-0.5">{k}</p>
              <p className="text-sm text-slate-900 font-medium">{v}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Share URL */}
      <SectionCard title="Share" subtitle="Give this link to visitors. Edit it freely — the QR code updates live.">
        <div className="flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            spellCheck={false}
            className="flex-1 text-xs text-slate-700 bg-slate-100 border border-slate-300 rounded-xl px-4 py-3 font-mono outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => copy(url, "url")}
            className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-300 hover:border-slate-400 text-sm text-slate-700 hover:text-slate-900 transition-colors shrink-0"
          >
            {copiedUrl ? "Copied!" : "Copy"}
          </button>
        </div>

        {/* QR */}
        <div className="flex items-center gap-4">
          <div className="w-32 h-32 bg-white rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt={`QR code for ${url}`} className="w-full h-full" />
            ) : (
              <p className="text-xs text-slate-500">…</p>
            )}
          </div>
          <div>
            <p className="text-sm text-slate-900 font-medium mb-1">QR Code</p>
            <p className="text-xs text-slate-500 mb-2">
              Scans directly to your live agent. Print and place near your installation.
            </p>
            <button
              onClick={downloadQr}
              disabled={!qrDataUrl}
              className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-300 hover:border-slate-400 text-sm text-slate-700 hover:text-slate-900 transition-colors disabled:opacity-40"
            >
              Download PNG
            </button>
          </div>
        </div>
      </SectionCard>

      {/* Embed */}
      <SectionCard
        title="Embed"
        subtitle="Drop into any webpage or kiosk browser."
      >
        <div className="relative">
          <code className="block text-xs text-slate-500 bg-slate-100 border border-slate-300 rounded-xl px-4 py-3 font-mono break-all leading-relaxed">
            {embedCode}
          </code>
        </div>
        <button
          onClick={() => copy(embedCode, "embed")}
          className="self-start px-4 py-2 rounded-xl bg-slate-100 border border-slate-300 hover:border-slate-400 text-sm text-slate-700 hover:text-slate-900 transition-colors"
        >
          {copiedEmbed ? "Copied!" : "Copy embed code"}
        </button>
      </SectionCard>

      <a
        href="/"
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
          />
        </svg>
        Open consumer view
      </a>
    </div>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────────

const NAV: { id: NavSection; label: string; icon: React.ReactNode }[] = [
  {
    id: "scene",
    label: "Scene",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5"
        />
      </svg>
    ),
  },
  {
    id: "character",
    label: "Character",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
    ),
  },
  {
    id: "videos",
    label: "Videos",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
        />
      </svg>
    ),
  },
  {
    id: "share",
    label: "Share & Deploy",
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
        />
      </svg>
    ),
  },
];

function isDone(id: NavSection, scene: Scene): boolean {
  if (id === "scene") return !!scene.name && !!scene.systemPrompt;
  if (id === "character") return !!scene.characterName;
  if (id === "videos")
    return scene.videos.length > 0 && scene.videos.every((v) => !!v.url);
  return false;
}

export default function CreatorPage() {
  const [active, setActive] = useState<NavSection>("scene");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Always start with defaultScene so server and client render identically (no hydration mismatch).
  // Load from localStorage in useEffect — client-only, runs after hydration.
  const [scene, setScene] = useState<Scene>(defaultScene);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load latest scene from DB on mount — source of truth is Postgres, not localStorage
  useEffect(() => {
    fetch("/api/scenes/latest")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setScene({ ...defaultScene, ...data });
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scene),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      const updated = { ...scene, slug: data.slug };
      setScene(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden">
      {/* ── Mobile backdrop ── */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* ── Sidebar — slides in as a drawer on mobile, static on desktop ── */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 md:w-56 shrink-0 flex flex-col border-r border-slate-200 bg-slate-50 transition-transform duration-200 md:transition-none ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="px-4 py-5 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-none">
                AgentStage
              </p>
              <p className="text-xs text-slate-500 mt-0.5">Creator</p>
            </div>
          </div>
        </div>

        {/* Scene name badge */}
        <div className="px-4 py-3 border-b border-slate-200">
          <p className="text-xs text-slate-500 mb-1">Current scene</p>
          <p className="text-sm text-slate-900 font-medium truncate">
            {scene.name || "Untitled scene"}
          </p>
          {scene.slug && (
            <p className="text-xs text-indigo-600/70 truncate mt-0.5">
              /{scene.slug}
            </p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 flex flex-col gap-1 overflow-y-auto">
          {NAV.map((item) => (
            <NavItem
              key={item.id}
              {...item}
              active={active === item.id}
              onClick={() => { setActive(item.id); setMobileNavOpen(false); }}
              done={isDone(item.id, scene)}
            />
          ))}
        </nav>

        {/* Bottom: save + preview */}
        <div className="px-3 py-3 border-t border-slate-200 flex flex-col gap-2">
          {saveError && (
            <p className="text-xs text-red-600 px-1">{saveError}</p>
          )}
          {saved && (
            <p className="text-xs text-emerald-600 flex items-center gap-1.5 px-1">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
              Saved successfully
            </p>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold text-white transition-colors"
          >
            {saving ? "Saving…" : "Save & publish"}
          </button>
          <a
            href="/"
            className="w-full py-2 rounded-xl border border-slate-300 hover:border-slate-400 text-sm text-slate-500 hover:text-slate-900 text-center transition-colors"
          >
            Preview →
          </a>
        </div>
      </aside>

      {/* ── Scrollable content ── */}
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* Sticky top bar */}
        <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200 px-4 md:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-slate-900 truncate">
                {NAV.find((n) => n.id === active)?.label}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {active === "scene" &&
                  "Core identity and behaviour of your agent"}
                {active === "character" &&
                  "Name and appearance of your character"}
                {active === "videos" && "Upload and label your video clips"}
                {active === "share" && "Share, embed or print your agent"}
              </p>
            </div>
          </div>
          {/* Progress pills */}
          <div className="hidden sm:flex items-center gap-2">
            {NAV.slice(0, 3).map((n) => (
              <div
                key={n.id}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  isDone(n.id, scene)
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                    : "bg-slate-100 border-slate-300 text-slate-500"
                }`}
              >
                {isDone(n.id, scene) ? (
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                )}
                {n.label}
              </div>
            ))}
          </div>
        </div>

        {/* Page content */}
        <div className="max-w-2xl mx-auto px-4 md:px-8 py-6 md:py-8">
          {active === "scene" && (
            <SectionScene scene={scene} onChange={setScene} />
          )}
          {active === "character" && (
            <SectionCharacter scene={scene} onChange={setScene} />
          )}
          {active === "videos" && (
            <SectionVideos scene={scene} onChange={setScene} />
          )}
          {active === "share" && <SectionShare scene={scene} />}
        </div>
      </main>
    </div>
  );
}
