# AgentStage

AgentStage is a multi-tenant platform for building voice-driven AI exhibition guides. A creator configures a character — name, personality, knowledge, and a set of video clips — and visitors interact with it by speaking naturally, getting real-time AI responses paired with a matching video performance.

Each agent is independent and lives at its own URL (e.g. `/hbk-saar-guide`, `/saarland-university-guide`), so the same platform can host guides for entirely different institutions — an exhibition, a university, a church — each owned and managed by a different creator, with an admin overseeing all of them.

Built with Next.js, Mistral AI, PostgreSQL, and ElevenLabs.

---

## Features

### Visitor experience (`/{agent-slug}`)

- Voice conversations: press-to-talk microphone capture, sent to server-side speech-to-text (ElevenLabs Scribe), with automatic German re-transcription when the detected language looks implausible
- Streaming AI replies (Mistral), spoken back via ElevenLabs TTS (falls back to the browser's built-in speech synthesis if that fails)
- Video performance: the AI picks the most fitting clip for each reply from the creator's uploaded set, or falls back to the idle clip if nothing fits
- **Barge-in**: visitors can interrupt the agent mid-answer by tapping the mic again — the in-flight response is discarded and the new question is heard immediately
- Multilingual: replies match whatever language the visitor spoke, and voice model selection adapts per language
- Optional "offer to show a clip" flow — the agent can ask permission before playing a specific real (e.g. student project) video, rather than assuming
- Idle/attract mode with a static greeting before the first interaction

### Creator dashboard (`/creator`)

- Login-protected; session persists across page refreshes
- **My Agents**: every creator sees only the agents they own — full multi-tenant isolation
- Create, edit, and delete agents
- Per agent: name, character name, knowledge/system prompt (typeable or `.txt` upload), idle message, custom URL, ElevenLabs voice picker, video clips (label/description/trigger/mute), display orientation
- **Share & Deploy**: shareable link, live QR code, embeddable iframe snippet — all reflect the agent's actual saved URL
- Preview and "Open consumer view" open the real live agent page in a new tab

### Admin panel (`/admin`)

- Visible only to accounts with the admin flag
- Add new creator accounts, reset any creator's password, delete creators (blocked if they still own agents, to avoid silent data loss)
- View every creator's agents and delete any agent, regardless of owner
- Set which agent the bare root URL (`/`) redirects visitors to

---

## Architecture

```text
Visitor  ──speaks──►  /api/stt (ElevenLabs Scribe)
                          │
                          ▼
                    /api/chat (Mistral, streamed) ──► loads the correct agent
                          │                            by slug from Postgres
                          ▼
                    /api/select-video ──► picks the best clip for this reply
                          │
                          ▼
                    /api/tts (ElevenLabs) ──► spoken back to the visitor
```

Every request that touches a specific agent (chat, video selection) is scoped by that agent's URL slug — nothing is ever inferred from "whichever agent was edited most recently."

---

## Tech stack

| Category         | Technology                                        |
| ----------------- | -------------------------------------------------- |
| Framework          | Next.js 16 (App Router, TypeScript)                |
| Chat AI            | Mistral AI (streaming)                             |
| Speech-to-text     | ElevenLabs Scribe                                  |
| Text-to-speech     | ElevenLabs (falls back to Web Speech API)          |
| Database           | Self-hosted PostgreSQL (`pg` pool)                 |
| Auth               | JWT (httpOnly cookie) + bcrypt                     |
| Styling            | Tailwind CSS                                       |
| Video delivery     | Static files, served directly by nginx             |
| Process manager    | pm2                                                 |
| Deployment         | Self-hosted Ubuntu server (not Vercel — see below) |

**Why not Vercel:** this project stores uploaded videos on the local filesystem and connects to Postgres over a raw TCP socket — neither works on Vercel's serverless/edge environment. The project is intentionally committed to a self-hosted server.

For a full breakdown of every file, API route, database table, and how they fit together, see [`DOCUMENTATION.md`](./DOCUMENTATION.md).

---

## Getting started (fresh clone → running app)

### 1. Prerequisites

- Node.js 20+
- A PostgreSQL server (13+) you can create a database on
- API keys: [Mistral](https://console.mistral.ai/) and [ElevenLabs](https://elevenlabs.io/)
- nginx, if deploying for real visitors (see [Production deployment](#production-deployment-self-hosted) below) — not required for local dev

### 2. Clone and install

```bash
git clone https://github.com/shahlajahangiri/HBK-Agent.git
cd HBK-Agent
npm install
```

### 3. Create the database and schema

```bash
sudo -u postgres createdb agentstage
sudo -u postgres psql -d agentstage -c "CREATE USER agentstage_user WITH PASSWORD 'choose_a_password';"
sudo -u postgres psql -d agentstage -c "GRANT ALL PRIVILEGES ON DATABASE agentstage TO agentstage_user;"
sudo -u postgres psql -d agentstage -c "ALTER TABLE IF EXISTS agent OWNER TO agentstage_user;" # no-op on a fresh DB, harmless
```

Then create the schema (run as a role with CREATE privileges — `sudo -u postgres psql -d agentstage`, or as `agentstage_user` if you granted it table ownership):

```sql
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agent (
  id                SERIAL PRIMARY KEY,
  owner_id          INTEGER NOT NULL REFERENCES users(id),
  name              TEXT NOT NULL,
  character_name    TEXT,
  system_prompt     TEXT,
  idle_message      TEXT,
  selection_prompt  TEXT,
  orientation       VARCHAR(20),
  show_bot_text     BOOLEAN DEFAULT true,
  idle_video_index  INTEGER DEFAULT 0,
  slug              TEXT UNIQUE,
  voice_id          TEXT,
  voice_name        TEXT,
  default_language  TEXT,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE videos (
  id               SERIAL PRIMARY KEY,
  agent_id         INTEGER NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  video_order      INTEGER,
  label            TEXT,
  description      TEXT,
  file_path        TEXT NOT NULL,
  trigger          TEXT,
  includes_speech  BOOLEAN DEFAULT false,
  muted            BOOLEAN DEFAULT false,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reserved for a future "reference document" feature — not yet used by any
-- route in the current codebase, but kept so existing deployments aren't broken.
CREATE TABLE knowledge_files (
  id           SERIAL PRIMARY KEY,
  agent_id     INTEGER NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
  filename     TEXT NOT NULL,
  file_path    TEXT NOT NULL,
  mime_type    TEXT,
  file_size    BIGINT,
  uploaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generic key/value store. Currently used for exactly one key,
-- 'default_agent_slug' — see app/api/settings/default-agent/route.ts
CREATE TABLE settings (
  id    SERIAL PRIMARY KEY,
  key   TEXT UNIQUE NOT NULL,
  value JSONB
);
```

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in every value in `.env.local`: `MISTRAL_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (any valid ElevenLabs voice ID — used as the fallback voice for agents that haven't picked their own), `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME` (matching what you created in step 3), and `JWT_SECRET` (any long random string — generate one with `openssl rand -base64 32`).

### 5. Create your first (admin) account

There's no public signup — the very first user has to be inserted directly. Generate a bcrypt password hash with Node (already installed as a dependency):

```bash
node -e "console.log(require('bcrypt').hashSync('your-chosen-password', 10))"
```

Copy the output (starts with `$2b$...`), then insert the admin user:

```bash
sudo -u postgres psql -d agentstage -c "INSERT INTO users (username, password_hash, is_admin) VALUES ('admin', '<paste hash here>', true);"
```

### 6. Run it

```bash
npm run dev
```

Visit `http://localhost:3000/creator`, log in with the account from step 5, and create your first agent. Every agent needs at least one uploaded video and a saved Custom URL before its live page (`/{slug}`) will work.

---

## Production deployment (self-hosted)

This project is built and tested for a self-hosted Ubuntu server, not Vercel (see the note under [Tech stack](#tech-stack)).

### Build and run with pm2

```bash
npm run build
pm2 start npm --name agentstage -- start
pm2 save
```

### nginx: serve uploaded videos directly (bypass Next.js)

Add this to your nginx server block, **above** the general `location /` proxy block:

```nginx
location /videos/ {
    alias /full/path/to/HBK-Agent/public/videos/;
}

location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_cache_bypass $http_upgrade;
    client_max_body_size 200M;
}
```

`client_max_body_size 200M` (or similar) is needed on the `/` block since video uploads go through the Next.js API route (`/api/upload`), not the `/videos/` alias.

After editing, reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Common gotcha:** the nginx worker process needs execute (`o+x`) permission on *every* directory in that path, not just the final `videos` folder — `public/`, the project root, and every parent directory above it, all need to be traversable by nginx's user. If videos 404 despite the file genuinely existing on disk, check permissions with `namei -l /full/path/to/HBK-Agent/public/videos/` before anything else.

**Another gotcha:** if the project folder ever gets renamed or re-cloned to a different path, the `alias` line above must be updated to match — nginx won't error, it'll just silently 404 every video, which looks exactly like a broken upload when it's actually a stale config path.

### Restarting after a fresh deploy or config change

If pm2 restart seems to hang or the app won't come back up, an orphaned `next-server` process is usually squatting on port 3000:

```bash
pm2 stop agentstage
sudo fuser -k 3000/tcp
sudo ss -ltnp 'sport = :3000'   # confirm nothing is listening before restarting
pm2 restart agentstage
```

---

## Project structure

See [`DOCUMENTATION.md`](./DOCUMENTATION.md) for a complete, file-by-file breakdown of every route, component, and database table, plus the authentication model and known limitations.

---

Developed at HBK Saar, Summer Semester 2026.

Supervised by Dr. Michael Schmitz, Experimental Media Lab, HBK Saar.

Created by Shahla Jahangiri and Arezoo Hassannezhad.
