# AgentStage — Technical Documentation

This document explains how AgentStage is structured and how the different parts of the application work together. It covers the database, project structure, authentication, API routes, visitor experience, creator dashboard, admin panel, and deployment.

For installation and setup instructions, see [`README.md`](./README.md).

---

## Project Context

AgentStage was developed as part of the **Media Infrastructures** lecture at the **Hochschule der Bildenden Künste Saar (HBKsaar)** during the **Summer Semester 2026**, under the supervision of **Prof. Dr. Michael Schmitz**.

The project explores how conversational AI, voice interaction, and video-based characters can be combined to create interactive digital guides. The goal was not only to build a single AI guide, but to create a platform that can be used to build and manage multiple independent guides.

**Hochschule:** Hochschule der Bildenden Künste Saar (HBKsaar)
**Lecture:** Media Infrastructures
**Semester:** Summer Semester 2026
**Supervision:** Prof. Dr. Michael Schmitz

---

## Table of Contents

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

## Core Concepts

* **Agent** — a configured AI character with its own name, personality, knowledge, videos, and voice. Each agent belongs to one creator through `agent.owner_id` and is available to visitors through its own URL, such as `/{agent.slug}`.

* **Creator** — a user who can log into `/creator` and manage the agents they own.

* **Admin** — a user with `is_admin = true`. Admins can manage creators and agents across the whole platform and can choose which agent the root `/` URL redirects to.

* **Scene** — the TypeScript representation of an agent used by the application. The database stores an agent as an `agent` row, while the frontend works with it as a `Scene` object.

One important design decision in AgentStage is that requests are always tied to a specific agent. The application does not try to guess which agent should be used based on the most recently edited or saved agent.

The agent's `slug` or `id` is passed explicitly whenever an operation needs to know which agent it is working with. This is especially important for the visitor-facing chat and video-selection APIs because multiple agents can be running on the same platform.

---

## Database Schema

AgentStage uses a self-hosted PostgreSQL database. The application connects to PostgreSQL through a shared `pg` connection pool defined in `lib/db.ts`.

There are five main tables:

* `users` — creator and admin accounts
* `agent` — agent configuration and ownership
* `videos` — videos belonging to each agent
* `knowledge_files` — reserved for future reference-document functionality
* `settings` — platform-level settings

### `users`

| Column          | Type                    | Notes                    |
| --------------- | ----------------------- | ------------------------ |
| `id`            | `SERIAL PRIMARY KEY`    | Unique user ID           |
| `username`      | `VARCHAR(50) UNIQUE`    | Login username           |
| `password_hash` | `TEXT`                  | bcrypt password hash     |
| `is_admin`      | `BOOLEAN DEFAULT false` | Gives access to `/admin` |
| `created_at`    | `TIMESTAMP`             | Account creation time    |

### `agent`

| Column             | Type                           | Notes                                        |
| ------------------ | ------------------------------ | -------------------------------------------- |
| `id`               | `SERIAL PRIMARY KEY`           | Unique agent ID                              |
| `owner_id`         | `INTEGER REFERENCES users(id)` | Creator who owns the agent                   |
| `name`             | `TEXT`                         | Internal agent name                          |
| `character_name`   | `TEXT`                         | Name shown to visitors                       |
| `system_prompt`    | `TEXT`                         | AI knowledge, personality, and instructions  |
| `idle_message`     | `TEXT`                         | Greeting shown before a conversation starts  |
| `selection_prompt` | `TEXT`                         | Present in the schema but not currently used |
| `orientation`      | `VARCHAR(20)`                  | `portrait`, `landscape`, or `auto`           |
| `show_bot_text`    | `BOOLEAN`                      | Whether the AI response is displayed as text |
| `idle_video_index` | `INTEGER`                      | Default/idle video                           |
| `slug`             | `TEXT UNIQUE`                  | Public URL for the agent                     |
| `voice_id`         | `TEXT`                         | ElevenLabs voice ID                          |
| `voice_name`       | `TEXT`                         | Name shown in the creator dashboard          |
| `default_language` | `TEXT`                         | Present in the schema but not currently used |
| `updated_at`       | `TIMESTAMP`                    | Last update time                             |

### `videos`

Each video belongs to one agent.

| Column            | Type                                             | Notes                                            |
| ----------------- | ------------------------------------------------ | ------------------------------------------------ |
| `id`              | `SERIAL PRIMARY KEY`                             | Unique video ID                                  |
| `agent_id`        | `INTEGER REFERENCES agent(id) ON DELETE CASCADE` | Agent that owns the video                        |
| `video_order`     | `INTEGER`                                        | Video index used by the application              |
| `label`           | `TEXT`                                           | Short name such as `Happy` or `Idle`             |
| `description`     | `TEXT`                                           | Description used when selecting a suitable clip  |
| `file_path`       | `TEXT`                                           | Path to the uploaded video                       |
| `trigger`         | `TEXT`                                           | `entering`, `leaving`, or empty for normal clips |
| `includes_speech` | `BOOLEAN`                                        | Whether the video contains its own spoken audio  |
| `muted`           | `BOOLEAN`                                        | Whether the video should always be muted         |
| `created_at`      | `TIMESTAMP`                                      | Upload time                                      |

### `knowledge_files`

This table is currently reserved for a possible future reference-document feature.

The current `.txt` upload in the creator dashboard does **not** use this table. The browser reads the file and places its text directly into the agent's system prompt.

### `settings`

A simple key/value table using PostgreSQL `JSONB`.

Currently the application uses it for:

* `default_agent_slug` — determines which agent the root `/` URL redirects to.

---

## Directory Structure

```text
app/
├── page.tsx
├── layout.tsx
├── globals.css
│
├── [slug]/
│   └── page.tsx
│
├── creator/
│   ├── page.tsx
│   ├── Login.tsx
│   ├── AgentList.tsx
│   └── Creator.tsx
│
├── admin/
│   └── page.tsx
│
└── api/
    ├── login/route.ts
    ├── logout/route.ts
    ├── me/route.ts
    │
    ├── agents/route.ts
    ├── agents/[id]/route.ts
    │
    ├── scenes/route.ts
    ├── scenes/[slug]/route.ts
    │
    ├── admin/agents/route.ts
    ├── admin/creators/route.ts
    ├── admin/creators/[id]/route.ts
    ├── admin/creators/[id]/agents/route.ts
    │
    ├── settings/default-agent/route.ts
    │
    ├── upload/route.ts
    ├── chat/route.ts
    ├── select-video/route.ts
    ├── stt/route.ts
    ├── tts/route.ts
    └── voices/route.ts

lib/
├── db.ts
├── auth.ts
├── scene.ts
├── scene-mapper.ts
└── load-scene.ts

public/
└── videos/
```

---

## Authentication & Authorization

AgentStage uses JWT-based authentication with an `httpOnly` cookie.

### Login

`/api/login`:

1. Receives the username and password.
2. Looks up the user in PostgreSQL.
3. Checks the password using bcrypt.
4. Creates a JWT containing the user's ID and username.
5. Stores the JWT in an `httpOnly` cookie named `token`.

### Protected routes

Protected routes use `getAuthUser()` from `lib/auth.ts`.

It:

1. Reads the `token` cookie.
2. Verifies the JWT using `JWT_SECRET`.
3. Looks up the user's current `is_admin` value from PostgreSQL.
4. Returns the authenticated user or `null`.

The admin status is intentionally read from the database rather than permanently stored in the JWT. This means changes to a user's admin status take effect without requiring a new login.

### Ownership

Creator-facing agent operations check the agent's `owner_id`.

An operation is allowed when:

```text
agent.owner_id === user.id
```

Admins can also access the agent because they have:

```text
user.isAdmin === true
```

This ownership check is important for keeping agents from different creators separate.

---

## The Visitor Experience — `app/[slug]/page.tsx`

This is the main visitor-facing page.

It is a client component that reads the agent slug from the URL and controls the complete conversation experience.

### Conversation phases

The page uses a simple state machine:

```text
idle
  ↓
listening
  ↓
thinking
  ↓
speaking
  ↓
idle
```

**Idle**
The agent shows its idle video and greeting.

**Listening**
The browser records the visitor's voice using `MediaRecorder`.

**Thinking**
The recording is sent to `/api/stt`, then the resulting text is sent to `/api/chat`.

**Speaking**
The response is converted to speech and played together with the selected video.

### Barge-in

Visitors can interrupt the agent while it is responding.

When the microphone is pressed during `thinking` or `speaking`:

1. The current request is marked as outdated.
2. Current audio playback is stopped.
3. Browser speech synthesis is cancelled if it is being used.
4. A new recording starts immediately.

The `activeRequestId` reference is used to make sure an older request cannot update the interface after a newer question has already started.

---

## Video Selection

Videos can have different roles.

Normal videos can be selected by the AI based on their labels and descriptions.

Special trigger videos can be configured as:

* `entering` — played when a conversation starts
* `leaving` — played when the conversation ends or times out

There is also an idle/default video that is shown when the agent is not actively responding.

If a selected video contains its own speech (`includes_speech = true`), the application waits until the AI response has finished before switching to that video.

---

## Optional Video Offer

Creators can add descriptions to videos that the AI can offer to visitors.

For example, an agent might mention that it has a video showing a particular student project.

The AI can add an internal marker such as:

```text
[[OFFER:2]]
```

The visitor never sees this marker.

If the visitor responds positively, the application plays the offered video directly instead of running another normal video-selection request.

---

## Multilingual Behavior

AgentStage is designed to support visitors speaking different languages.

### Speech recognition

ElevenLabs Scribe automatically detects the spoken language. If the detected language looks unreliable, the application can retry the transcription with German explicitly selected.

### AI response

The chat prompt tells Mistral to respond in the language used by the visitor.

### Text-to-speech

The application chooses an ElevenLabs TTS model depending on the detected language and falls back to browser speech synthesis if ElevenLabs TTS fails.

---

## Creator Dashboard — `app/creator/`

The creator dashboard is where agents are created and managed.

### `page.tsx`

Checks the current session through `/api/me` and decides whether to show:

* `Login`
* `AgentList`
* `Creator`

### `Login.tsx`

Contains the username/password login form and sends the credentials to `/api/login`.

### `AgentList.tsx`

Shows the agents owned by the current creator.

Creators can:

* Open an agent for editing
* Create a new agent
* Delete an agent
* Log out
* Open the admin panel if they are an admin

### `Creator.tsx`

This is the main agent editor.

The editor is divided into four areas:

**Scene**

* Agent name
* Custom URL
* System prompt/knowledge
* Idle message
* Display orientation
* Reply-text visibility

**Character**

* Character name
* ElevenLabs voice
* Voice preview

**Videos**

* Upload videos
* Set labels and descriptions
* Configure triggers
* Configure mute behavior
* Reorder clips

**Share & Deploy**

* Live agent URL
* QR code
* iframe embed code
* Preview
* Open consumer view

A new agent starts with a blank configuration. It does not copy content from another agent.

---

## Admin Panel — `app/admin/page.tsx`

The admin panel is available only to users with `is_admin = true`.

It provides:

### Default agent

The admin can select which agent should be used when someone visits `/`.

### Creator management

Admins can:

* Create creator accounts
* Reset passwords
* View creators
* Delete creators when they no longer own agents

Creators who still own agents cannot be deleted directly, which prevents accidental loss of their agents.

### Agent management

Admins can see agents across the whole platform and delete them when necessary.

---

## Full API Reference

| Route                             | Method | Auth           | Purpose                                 |
| --------------------------------- | ------ | -------------- | --------------------------------------- |
| `/api/login`                      | POST   | —              | Verify credentials and create a session |
| `/api/logout`                     | POST   | —              | Clear the session cookie                |
| `/api/me`                         | GET    | Logged-in user | Return current user information         |
| `/api/agents`                     | GET    | Logged-in user | List the caller's agents                |
| `/api/agents`                     | POST   | Logged-in user | Create a new agent                      |
| `/api/agents/[id]`                | GET    | Owner/Admin    | Fetch an agent                          |
| `/api/agents/[id]`                | DELETE | Owner/Admin    | Delete an agent                         |
| `/api/scenes`                     | POST   | Owner/Admin    | Save agent configuration                |
| `/api/scenes/[slug]`              | GET    | Public         | Load an agent by slug                   |
| `/api/admin/agents`               | GET    | Admin          | List all agents                         |
| `/api/admin/creators`             | GET    | Admin          | List all creators                       |
| `/api/admin/creators`             | POST   | Admin          | Create a creator                        |
| `/api/admin/creators/[id]`        | PUT    | Admin          | Reset a password                        |
| `/api/admin/creators/[id]`        | DELETE | Admin          | Delete a creator                        |
| `/api/admin/creators/[id]/agents` | GET    | Admin          | List one creator's agents               |
| `/api/settings/default-agent`     | GET    | Public         | Get the default agent                   |
| `/api/settings/default-agent`     | PUT    | Admin          | Change the default agent                |
| `/api/upload`                     | POST   | Logged-in user | Upload a video                          |
| `/api/chat`                       | POST   | Public         | Generate a streamed AI response         |
| `/api/select-video`               | POST   | Public         | Select a suitable video                 |
| `/api/stt`                        | POST   | Public         | Convert speech to text                  |
| `/api/tts`                        | POST   | Public         | Convert text to speech                  |
| `/api/voices`                     | GET    | Public         | Search available ElevenLabs voices      |

The visitor-facing APIs are intentionally public because visitors do not need an account to interact with an agent.

---

## Shared Library Code — `lib/`

### `db.ts`

Creates the shared PostgreSQL `Pool` used throughout the application.

### `auth.ts`

Contains `getAuthUser()`, which handles JWT verification and retrieves the current user's permissions.

### `scene.ts`

Defines the `Scene` and `VideoClip` TypeScript interfaces.

It also contains a neutral fallback scene used before the real agent has loaded or when an agent cannot be found.

The fallback does not contain another agent's data.

### `scene-mapper.ts`

Converts database rows into the format expected by the frontend.

It mainly handles the difference between PostgreSQL's `snake_case` fields and the application's `camelCase` fields.

### `load-scene.ts`

Loads an agent and its videos from PostgreSQL using the agent's slug.

This function is used by the visitor-facing AI routes, particularly `/api/chat` and `/api/select-video`.

---

## Known Limitations & Unused Pieces

A few parts of the codebase are currently present but are not actively used.

### `agent.selection_prompt`

The column exists in the database but the current video-selection route creates its own prompt dynamically.

### `agent.default_language`

The column exists but is not currently used by the application.

### `knowledge_files`

The table exists for a possible future reference-document feature. The current `.txt` upload functionality does not store files in this table.

### `cookie` npm package

The dependency exists in `package.json`, but the application currently uses Next.js's built-in cookie handling instead.

It can be removed if it is not needed elsewhere.

### Agent slug

When adding new functionality, always pass the agent's `slug` or `id` explicitly.

Avoid relying on global state or assumptions about which agent was edited most recently. Since AgentStage supports multiple independent agents, keeping the agent context explicit is important for both correctness and isolation.

---

## Deployment Notes & Operational Gotchas

The production deployment uses a self-hosted Ubuntu server with Next.js, pm2, PostgreSQL, and nginx.

### 1. nginx video paths

Uploaded videos are stored under the project's `public/videos/` directory and served directly by nginx.

If the project is moved or re-cloned to another location, the nginx `alias` path needs to be updated.

If videos suddenly return `404` while the files exist on disk, check the nginx path and directory permissions first.

### 2. Port 3000

Sometimes an old `next-server` process can continue running after a deployment or restart.

If pm2 cannot restart the application correctly, check which process is using port 3000:

```bash
sudo ss -ltnp 'sport = :3000'
```

If necessary:

```bash
pm2 stop agentstage
sudo fuser -k 3000/tcp
pm2 restart agentstage
```

### 3. PostgreSQL table ownership

When changing the database schema, PostgreSQL may report:

```text
must be owner of table
```

This usually means the table belongs to another PostgreSQL role.

The migration can either be run as the PostgreSQL administrator or ownership can be transferred to the application's database user.

---

## Final Notes

AgentStage is a student project developed for the **Media Infrastructures** lecture at **Hochschule der Bildenden Künste Saar (HBKsaar)** during the **Summer Semester 2026**, under the supervision of **Prof. Dr. Michael Schmitz**.

The documentation is intended to make it easier for future developers or project members to understand how the application works, run it locally, deploy it, and extend it without accidentally breaking the separation between different agents.
