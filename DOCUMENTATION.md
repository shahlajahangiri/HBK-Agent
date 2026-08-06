# AgentStage — Technical Documentation

This document describes every part of the codebase in detail: the database schema, every file and folder, the authentication model, every API route, and how the pieces fit together. For setup instructions, see [`README.md`](./README.md).

---

## Table of contents

1. [Core concepts](#core-concepts)
2. [Database schema](#database-schema)
3. [Directory structure](#directory-structure)
4. [Authentication & authorization](#authentication--authorization)
5. [The visitor experience — `app/[slug]/page.tsx`](#the-visitor-experience--appslugpagetsx)
6. [The creator dashboard — `app/creator/`](#the-creator-dashboard--appcreator)
7. [The admin panel — `app/admin/page.tsx`](#the-admin-panel--appadminpagetsx)
8. [Full API reference](#full-api-reference)
9. [Shared library code — `lib/`](#shared-library-code--lib)
10. [Known limitations & unused-but-present pieces](#known-limitations--unused-but-present-pieces)
11. [Deployment notes & operational gotchas](#deployment-notes--operational-gotchas)

---

## Core concepts

- **Agent** — one configured character (name, personality, knowledge, videos, voice). Every agent belongs to exactly one **creator** (a `users` row) via `agent.owner_id`, and is reachable by visitors at `/{agent.slug}`.
- **Creator** — a `users` row that can log into `/creator`, manage only the agents they own.
- **Admin** — a `users` row with `is_admin = true`. Can manage all creators and all agents, and picks which agent the bare `/` URL redirects to.
- **Scene** — the TypeScript shape (`lib/scene.ts`'s `Scene` interface) that an agent's database row gets mapped into for use by the frontend. "Agent" and "Scene" refer to the same thing at different layers (DB row vs. app-level object).

Nothing in this app is scoped by "whichever agent was most recently saved" — every visitor-facing and creator-facing operation is scoped explicitly by agent `id` or `slug`. This was a real bug earlier in the project's history (see [Known limitations](#known-limitations--unused-but-present-pieces) for what to watch for if you see similar patterns creep back in).

---

## Database schema

Five tables, all in the default `public` schema of a self-hosted PostgreSQL database (`pg` connection pool, see `lib/db.ts`).

### `users`

| Column          | Type                    | Notes                                  |
| --------------- | ----------------------- | --------------------------------------- |
| `id`             | `SERIAL PRIMARY KEY`    |                                          |
| `username`       | `VARCHAR(50) UNIQUE`    |                                          |
| `password_hash`  | `TEXT`                  | bcrypt hash, 10 rounds                  |
| `is_admin`       | `BOOLEAN DEFAULT false` | grants access to `/admin`                |
| `created_at`     | `TIMESTAMP`             |                                          |

### `agent`

| Column              | Type                     | Notes                                                                    |
| -------------------- | ------------------------ | -------------------------------------------------------------------------- |
| `id`                  | `SERIAL PRIMARY KEY`     |                                                                              |
| `owner_id`            | `INTEGER REFERENCES users(id)` | which creator owns this agent                                       |
| `name`                | `TEXT`                   | internal label, not shown to visitors                                    |
| `character_name`      | `TEXT`                   | shown to visitors (e.g. "Mira")                                          |
| `system_prompt`       | `TEXT`                   | the AI's knowledge/personality instructions                              |
| `idle_message`        | `TEXT`                   | static greeting shown before any conversation starts                     |
| `selection_prompt`    | `TEXT`                   | present in the schema but **not read by any current route** — see [Known limitations](#known-limitations--unused-but-present-pieces) |
| `orientation`         | `VARCHAR(20)`            | `"portrait"` \| `"landscape"` \| `"auto"`                                |
| `show_bot_text`       | `BOOLEAN`                | whether the reply text is shown on screen alongside speech               |
| `idle_video_index`    | `INTEGER`                | which video's `video_order` counts as the idle/default clip              |
| `slug`                | `TEXT UNIQUE`            | the agent's URL — `/{slug}`                                              |
| `voice_id`            | `TEXT`                   | ElevenLabs voice ID; falls back to `ELEVENLABS_VOICE_ID` env var if null |
| `voice_name`          | `TEXT`                   | display name for the picked voice                                        |
| `default_language`    | `TEXT`                   | present in the schema, not currently read anywhere in the app            |
| `updated_at`          | `TIMESTAMP`              |                                                                              |

### `videos`

One row per uploaded clip, always belongs to exactly one agent.

| Column             | Type                                       | Notes                                                                 |
| ------------------- | ------------------------------------------- | ------------------------------------------------------------------------ |
| `id`                 | `SERIAL PRIMARY KEY`                        |                                                                            |
| `agent_id`           | `INTEGER REFERENCES agent(id) ON DELETE CASCADE` | deleting an agent deletes its videos automatically                  |
| `video_order`        | `INTEGER`                                   | the "index" used everywhere in the app to refer to this clip             |
| `label`              | `TEXT`                                      | short name (e.g. "Happy", "Idle")                                        |
| `description`        | `TEXT`                                      | used both as a creator-facing hint and as the text the AI reads when picking a clip |
| `file_path`          | `TEXT`                                      | e.g. `/videos/1785943686233_ghoststory.mp4` — served by nginx, not Next.js |
| `trigger`            | `TEXT`                                      | `"entering"` (plays once when a conversation starts) or `"leaving"` (plays on goodbye/timeout); null for normal selectable clips |
| `includes_speech`    | `BOOLEAN`                                   | if true, the clip itself has spoken audio — video switch is delayed until the AI's spoken reply finishes, instead of playing immediately |
| `muted`              | `BOOLEAN`                                   | if true, this clip always plays muted regardless of the visitor's mute toggle |
| `created_at`         | `TIMESTAMP`                                 |                                                                            |

### `knowledge_files`

Exists in the schema, has a foreign key to `agent`, but **no route in the current codebase reads or writes it**. See [Known limitations](#known-limitations--unused-but-present-pieces).

### `settings`

Generic key/value store (`value` is `JSONB`). Currently used for exactly one key:

- `default_agent_slug` — the slug the bare `/` root URL redirects to. Set via the admin panel, read by `app/page.tsx` and `app/api/settings/default-agent/route.ts`.

---

## Directory structure

```text
app/
├── page.tsx                          # root "/" — redirects to the admin-picked default agent
├── layout.tsx                        # root layout (html/body, page metadata)
├── globals.css                       # Tailwind entry point
│
├── [slug]/
│   └── page.tsx                      # THE VISITOR-FACING PAGE — one agent's live experience
│
├── creator/
│   ├── page.tsx                      # entry point: session check → Login | AgentList | Creator
│   ├── Login.tsx                     # username/password form, posts to /api/login
│   ├── AgentList.tsx                 # "My Agents" — list/create/delete, scoped to the logged-in creator
│   └── Creator.tsx                   # the full agent editor (Scene / Character / Videos / Share tabs)
│
├── admin/
│   └── page.tsx                      # admin-only: creators list, add/delete/reset-password, default-agent picker
│
└── api/
    ├── login/route.ts                # POST — verify credentials, issue JWT cookie
    ├── logout/route.ts               # POST — clear the JWT cookie
    ├── me/route.ts                   # GET  — "am I logged in, and am I an admin?"
    │
    ├── agents/route.ts               # GET (list my agents) / POST (create new agent) — owner-scoped
    ├── agents/[id]/route.ts          # GET (fetch one, for editing) / DELETE — owner or admin only
    │
    ├── scenes/route.ts               # POST — save (update) an agent's full configuration
    ├── scenes/[slug]/route.ts        # GET  — PUBLIC, fetch one agent's data by slug (used by the visitor page)
    │
    ├── admin/agents/route.ts                    # GET — all agents system-wide, admin only
    ├── admin/creators/route.ts                  # GET (list creators + agent counts) / POST (create creator) — admin only
    ├── admin/creators/[id]/route.ts             # PUT (reset password) / DELETE (remove creator) — admin only
    ├── admin/creators/[id]/agents/route.ts      # GET — one creator's agents, admin only
    │
    ├── settings/default-agent/route.ts # GET (public) / PUT (admin only) — the default-agent setting
    │
    ├── upload/route.ts               # POST — save a video file to disk; requires login
    ├── chat/route.ts                 # POST — streamed AI reply for a given agent slug
    ├── select-video/route.ts         # POST — AI picks the best-matching video clip index
    ├── stt/route.ts                  # POST — speech-to-text (ElevenLabs Scribe)
    ├── tts/route.ts                  # POST — text-to-speech (ElevenLabs)
    └── voices/route.ts               # GET  — search ElevenLabs' shared voice library

lib/
├── db.ts             # the shared `pg` Pool instance — imported by every route that touches Postgres
├── auth.ts           # getAuthUser() — reads the JWT cookie, looks up is_admin fresh from the DB
├── scene.ts           # the Scene/VideoClip TypeScript types, and a neutral fallback Scene object
├── scene-mapper.ts    # toScene() — maps a raw `agent` + `videos` DB rows into a Scene object
└── load-scene.ts      # loadScene(slug) — fetch one agent's full Scene by slug, with graceful fallback

public/
└── videos/            # uploaded video files live here on disk (gitignored — see .gitignore)
```

---

## Authentication & authorization

- **Login** (`/api/login`): checks `username`/`password_hash` (bcrypt) against `users`, signs a JWT containing `{ id, username }`, and sets it as an `httpOnly` cookie named `token`.
- **Every protected route** calls `getAuthUser()` (`lib/auth.ts`), which:
  1. Reads the `token` cookie.
  2. Verifies the JWT signature (`JWT_SECRET`).
  3. Looks up `is_admin` **fresh from the database** on every call (not baked into the JWT) — so promoting/demoting a user, or changing their password, takes effect immediately without needing them to log in again.
  4. Returns `{ id, username, isAdmin }` or `null`.
- **Ownership checks** are done per-route by comparing `agent.owner_id === user.id`, with `|| user.isAdmin` added wherever admins should also have access.
- **Session persistence**: `/creator` and `/admin` both call `GET /api/me` on mount to check for an existing valid session, rather than relying on in-memory React state — this is what makes login survive a page refresh.
- **Logout** (`/api/logout`): overwrites the `token` cookie with an empty value and `maxAge: 0`.
- **What's intentionally public** (no auth required): the visitor-facing page and everything it calls — `GET /api/scenes/[slug]`, `POST /api/chat`, `POST /api/select-video`, `POST /api/stt`, `POST /api/tts`, `GET /api/voices`, and `GET /api/settings/default-agent`. These all need to work for anonymous visitors with no login at all.

---

## The visitor experience — `app/[slug]/page.tsx`

This is the single largest and most stateful file in the project. It's a client component (`"use client"`) that reads the agent's slug from the URL via `useParams()`, and drives the entire conversation loop.

### Phases

A `phase` state machine drives the UI: `"idle" → "listening" → "thinking" → "speaking" → "idle"`.

- **idle** — showing the idle video and static idle message, mic button ready
- **listening** — recording the visitor's voice (`MediaRecorder`), with silence detection to auto-stop
- **thinking** — audio sent to `/api/stt` for transcription, then to `/api/chat` for a streamed reply
- **speaking** — reply is being read aloud (ElevenLabs TTS, or browser speech synthesis as a fallback) while the matched video plays

### Barge-in (interrupting mid-reply)

The mic button is clickable in **every** phase, not just `idle`. Clicking it during `thinking` or `speaking`:

1. Increments a `activeRequestId` ref — every async step of the in-flight `sendMessage()` call checks this ref before mutating state, and silently bails out if it's been superseded. This is what stops a stale response from "winning" and resuming audio/video after you've already asked something new.
2. Calls `stopSpeaking()` — stops the current `AudioBufferSourceNode` (or cancels `speechSynthesis` if using the fallback path).
3. Immediately calls `startListening()` for the new question.

### Video selection & idle fallback

- The **idle video** shows on first page load and whenever no specific clip is judged to fit a reply (see `/api/select-video`).
- Once a topic video is chosen for a reply, it plays on loop (`<video loop>`) and does **not** get force-reset to idle just because the spoken audio finished — a video can run longer than its narration without being cut off. It only changes when a new question produces a new selection, or after a real period of inactivity (see the "leaving" trigger below).
- If a clip has `trigger: "entering"`, it plays once automatically when a conversation first starts, then reverts to idle after 3 seconds.
- If a clip has `trigger: "leaving"`, it plays once when the visitor says goodbye or after an inactivity timeout, then the conversation resets.
- If a clip has `includes_speech: true`, the video switch itself is delayed until the AI's spoken reply finishes (since the clip has its own audio and shouldn't play under narration).

### The "offer to show a clip" flow

The system prompt sent to Mistral (built in `/api/chat`) lists any of the agent's videos that have a `description` and no `trigger` as "real clips" the AI can offer to show (e.g. an actual student project recording). If the AI decides one is relevant, it ends its reply with a hidden `[[OFFER:<index>]]` marker. The client strips this marker before displaying/speaking the reply, but remembers the offered index — if the visitor's next message is affirmative (matched against a regex of "yes"/"sure"/etc. in several languages), that exact clip plays instead of running the reply back through the normal AI video-selector.

### Multilingual behavior

- STT (`/api/stt`) uses ElevenLabs Scribe with automatic language detection, but re-transcribes forcing German if the detected language is outside an expected set or the confidence is low — tuned for a mixed German/international visitor base.
- The chat system prompt instructs the model to always reply in whatever language the visitor's message is written in.
- TTS (`/api/tts`) picks between ElevenLabs' faster `eleven_flash_v2_5` model and the slower but more broadly multilingual `eleven_v3` model, based on whether the detected language is in a known-good list for the flash model.

---

## The creator dashboard — `app/creator/`

### `page.tsx` — entry point

A small state machine: checks `/api/me` on mount → shows `Login` if not authenticated → shows `AgentList` if authenticated with no agent selected → shows `Creator` (the editor) once an agent is picked. Also owns the `logout()` call.

### `Login.tsx`

Simple username/password form. Posts to `/api/login`; on success, calls the `onSuccess` callback passed down from `page.tsx`.

### `AgentList.tsx` — "My Agents"

Fetches `GET /api/agents` (owner-scoped). Each card can be clicked to open that agent in `Creator`, or deleted (with a confirmation prompt) via `DELETE /api/agents/[id]`. "+ New agent" calls `POST /api/agents` to create a blank agent, then immediately opens it for editing. Shows a "Log out" button, and an "Admin panel" link/button if the logged-in user is an admin.

### `Creator.tsx` — the agent editor

The largest file in the project. Four tabs, all editing one in-memory `scene` object that gets saved as a whole via `POST /api/scenes`:

- **Scene** — name, Custom URL (slug), knowledge/system prompt (typeable, or drag-and-drop a `.txt` file to fill it in), idle message, display orientation, "show reply as text" toggle.
- **Character** — character name, ElevenLabs voice picker (search/filter the shared voice library via `/api/voices`, preview a voice before picking it).
- **Videos** — upload clips (`POST /api/upload`), set label/description/trigger/mute per clip, reorder. Shows a one-time tip listing common category ideas (Idle/Happy/Serious/Entering/Leaving) when the agent has zero clips — this is UI guidance only, not real data.
- **Share & Deploy** — shows the agent's real live URL (only once it has a saved slug), a live-updating QR code, an embeddable iframe snippet, and "Open consumer view"/"Preview" links that open the actual `/{slug}` page in a new tab.

A brand-new agent starts from a genuinely blank state (`blankScene`), not from any other agent's real content — this matters because it's what stops one agent's data from ever flashing/leaking into a different agent's editor.

---

## The admin panel — `app/admin/page.tsx`

Same session-check pattern as the creator dashboard, but additionally requires `isAdmin` — a logged-in non-admin sees an "Admin access only" message instead of the panel.

Sections:

1. **Default agent for the root URL** — a dropdown of every agent system-wide (`GET /api/admin/agents`), saved via `PUT /api/settings/default-agent`.
2. **Add a new creator** — username + password form, `POST /api/admin/creators`.
3. **Creators list** — every user, with their agent count. Each row has "Reset password" (`PUT /api/admin/creators/[id]`) and "Delete" (`DELETE /api/admin/creators/[id]`, blocked with a clear error if the creator still owns agents — you have to delete or reassign those first). Admin accounts themselves can't be deleted from this button.
4. **Selected creator's agents** — clicking a creator drills into `GET /api/admin/creators/[id]/agents`, with a delete button per agent (same `DELETE /api/agents/[id]` endpoint the creator dashboard uses — an admin passes the ownership check via `isAdmin` rather than matching `owner_id`).

---

## Full API reference

| Route | Method | Auth | Purpose |
| ----- | ------ | ---- | ------- |
| `/api/login` | POST | — | Verify credentials, set JWT cookie |
| `/api/logout` | POST | — | Clear JWT cookie |
| `/api/me` | GET | any logged-in user | Returns `{id, username, isAdmin}` or 401 — used for session-persistence checks |
| `/api/agents` | GET | any logged-in user | List agents owned by the caller |
| `/api/agents` | POST | any logged-in user | Create a new blank agent owned by the caller |
| `/api/agents/[id]` | GET | owner or admin | Fetch one agent's full data, for editing |
| `/api/agents/[id]` | DELETE | owner or admin | Delete an agent (cascades to its videos) |
| `/api/scenes` | POST | owner or admin | Save (full update of) an agent's configuration and video list |
| `/api/scenes/[slug]` | GET | **public** | Fetch one agent's data by slug — what the visitor page loads |
| `/api/admin/agents` | GET | admin only | All agents system-wide, with owner username |
| `/api/admin/creators` | GET | admin only | All users, with agent counts |
| `/api/admin/creators` | POST | admin only | Create a new creator account |
| `/api/admin/creators/[id]` | PUT | admin only | Reset a creator's password |
| `/api/admin/creators/[id]` | DELETE | admin only | Delete a creator (blocked if they still own agents; can't delete yourself) |
| `/api/admin/creators/[id]/agents` | GET | admin only | One specific creator's agents |
| `/api/settings/default-agent` | GET | **public** | Current default-agent slug for the root URL redirect |
| `/api/settings/default-agent` | PUT | admin only | Set the default-agent slug |
| `/api/upload` | POST | any logged-in user | Save a video file to `public/videos/`; returns its URL (DB linkage happens later via `/api/scenes`) |
| `/api/chat` | POST | **public** | Streamed AI reply; body includes `slug` so the correct agent's knowledge is used |
| `/api/select-video` | POST | **public** | AI picks the best-matching clip index for a reply; body includes `slug` |
| `/api/stt` | POST | **public** | Transcribe an audio blob (ElevenLabs Scribe) |
| `/api/tts` | POST | **public** | Synthesize speech for a given voice ID (ElevenLabs) |
| `/api/voices` | GET | **public** | Search ElevenLabs' shared voice library (used by the Character tab's voice picker) |

Routes marked **public** are intentionally unauthenticated — they're either what anonymous visitors need, or read-only data (the default-agent slug) needed before any login has happened.

---

## Shared library code — `lib/`

- **`db.ts`** — a single shared `pg.Pool`, configured from `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`. Every route that touches Postgres imports this same pool rather than opening its own connection.
- **`auth.ts`** — `getAuthUser()`, described above under [Authentication & authorization](#authentication--authorization).
- **`scene.ts`** — defines the `Scene` and `VideoClip` TypeScript interfaces (the shape every agent gets mapped into), plus a `scene` export that is a **neutral, generic fallback** (empty name/prompt, no videos) — used only as the initial render state before a real agent loads, and as the ultimate fallback if a slug can't be found. It deliberately does **not** contain any specific agent's real content, so that a slow network request or a broken link never flashes or falls back to some other agent's actual data.
- **`scene-mapper.ts`** — `toScene(agentRow, videoRows)` converts raw Postgres rows (snake_case columns, nullable) into a clean `Scene` object (camelCase, nulls coalesced to safe empty defaults like `""` or `[]`).
- **`load-scene.ts`** — `loadScene(slug)`, the function actually used by `/api/chat` and `/api/select-video` to fetch one specific agent by slug. Falls back to the neutral `scene.ts` default on any DB error or missing slug — this is a deliberate best-effort fallback so a transient DB hiccup shows a generic (not broken, not wrong-agent) experience rather than crashing the request.

---

## Known limitations & unused-but-present pieces

Worth knowing about if you're extending this project, so you don't assume something is wired up when it isn't:

- **`agent.selection_prompt`** — exists in the schema and gets saved/loaded, but no route currently reads it. Video selection logic (`/api/select-video`) builds its own prompt dynamically from each agent's video labels/descriptions instead. There's no UI field to edit it either. Safe to ignore, or worth removing from the schema if you want to fully clean it up.
- **`agent.default_language`** — same story: exists in the schema, not read anywhere.
- **`knowledge_files` table** — has a foreign key to `agent` and looks feature-shaped, but nothing reads or writes to it. The actual ".txt knowledge upload" feature (in the Creator's Scene tab) works differently — it reads the file client-side with the browser's `FileReader` and drops the text straight into the system prompt textarea; it never touches this table or the server at all. This table looks like scaffolding for a planned-but-unbuilt "attach reference documents" feature.
- **`cookie` npm package** — listed in `package.json` dependencies but never imported anywhere (the project uses Next.js's built-in `cookies()` helper instead, via `next/headers`). Safe to remove with `npm uninstall cookie` if you want a fully clean dependency tree.
- **Multi-agent correctness is load-bearing on passing `slug` explicitly.** If you ever add a new feature that needs to know "which agent," make sure it receives the slug (or agent id) explicitly from the client — don't reach for "the most recently updated agent" as a shortcut. That exact pattern caused real cross-agent data leaks earlier in this project (one agent's visitors briefly got a different agent's replies and system prompt) before being fixed by threading `slug` through `/api/chat`, `/api/select-video`, and `lib/load-scene.ts`.

---

## Deployment notes & operational gotchas

See the [Production deployment](./README.md#production-deployment-self-hosted) section of the README for the actual setup steps. The most common issues in practice have been:

1. **nginx serving stale video paths after a project folder rename/re-clone** — the `/videos/` `alias` in the nginx config is a literal filesystem path; it does not update itself. If videos suddenly all 404 despite existing on disk, check this first.
2. **Orphaned `next-server` processes holding port 3000**, blocking `pm2 restart` from actually taking effect. Always confirm the port is free (`sudo ss -ltnp 'sport = :3000'`) after a `pm2 stop` and before restarting.
3. **Table ownership** — if a fresh migration/`ALTER TABLE` fails with "must be owner of table," it's almost always because the table is owned by the `postgres` superuser rather than your app's role; either run the migration as `sudo -u postgres psql ...`, or transfer ownership once with `ALTER TABLE <table> OWNER TO agentstage_user;`.
