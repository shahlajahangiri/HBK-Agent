# AgentStage

AgentStage is a web-based platform for creating voice-driven AI guides.

The idea is simple: a creator can build an AI character by giving it a name, personality, knowledge, voice, and a set of video clips. Visitors can then talk to the character naturally using their voice. The AI responds in real time, speaks the answer back, and can play a video that matches the response.

Each agent has its own URL, such as `/hbk-saar-guide` or `/saarland-university-guide`. This means the same platform can be used for different projects, exhibitions, universities, or other institutions without having to build a separate application for each one.

AgentStage was developed as part of the **Media Infrastructures** lecture at the **Hochschule der Bildenden Künste Saar (HBKsaar)** during the **Summer Semester 2026**, under the supervision of **Prof. Dr. Michael Schmitz**.

The project combines conversational AI, voice interaction, and video-based character performance into one system.

---

## Project Context

**Hochschule:** Hochschule der Bildenden Künste Saar (HBKsaar)
**Lecture:** Media Infrastructures
**Semester:** Summer Semester 2026
**Supervision:** Prof. Dr. Michael Schmitz

The project started from the idea of creating a more natural way for visitors to interact with digital guides. Instead of reading information from a screen or using a traditional chatbot, visitors can simply speak to the character and have a conversation.

The system was designed to be reusable. Creators can set up their own agents, provide the information and media they need, and publish each agent through its own URL.

---

## Features

### Visitor Experience (`/{agent-slug}`)

* **Voice conversations** — visitors can press the microphone button, speak, and send their question to the AI.
* **Speech-to-text** — ElevenLabs Scribe converts the visitor's speech into text.
* **Streaming AI responses** — Mistral generates the response and starts sending it while it is being generated.
* **Text-to-speech** — the response is spoken using ElevenLabs, with the browser's built-in speech synthesis as a fallback.
* **Video performance** — the system chooses a suitable video clip based on the AI's response.
* **Barge-in** — visitors can interrupt the agent while it is speaking and immediately ask another question.
* **Multilingual conversations** — the agent responds in the language used by the visitor.
* **Optional video suggestions** — the agent can ask the visitor if they want to see a specific video before playing it.
* **Idle mode** — before the first interaction, the agent can show an idle video and greeting.

### Creator Dashboard (`/creator`)

Creators can manage their own agents through a protected dashboard.

* Create, edit, and delete agents
* Configure the character's name and personality
* Add knowledge or upload a `.txt` knowledge file
* Configure the idle message
* Choose an ElevenLabs voice
* Upload and manage video clips
* Add labels, descriptions, and triggers to videos
* Configure the display orientation
* Set a custom URL/slug for each agent
* Preview the agent before publishing
* Generate a shareable link and QR code
* Generate an embeddable iframe
* Open the live visitor view directly

Each creator only has access to the agents they own.

### Admin Panel (`/admin`)

The admin panel is used to manage the platform.

* Create creator accounts
* Reset creator passwords
* Delete creator accounts
* View all agents and their owners
* Delete agents when necessary
* Choose which agent is shown at the root URL (`/`)

Creators cannot access or modify other creators' agents.

---

## How It Works

The basic interaction looks like this:

```text
Visitor
   │
   │ speaks
   ▼
/api/stt
   │
   │ ElevenLabs Scribe
   ▼
/api/chat
   │
   │ Mistral AI
   │
   │ loads agent configuration from PostgreSQL
   ▼
/api/select-video
   │
   │ finds the most suitable video
   ▼
/api/tts
   │
   │ ElevenLabs
   ▼
Visitor hears the response
```

Each request is connected to a specific agent through its URL slug. This is important because the platform can host multiple independent agents at the same time.

For example:

```text
/hbk-saar-guide
/saarland-university-guide
/exhibition-guide
```

Each URL loads its own character, knowledge, voice, and videos.

---

## Tech Stack

| Category        | Technology                         |
| --------------- | ---------------------------------- |
| Framework       | Next.js 16, App Router, TypeScript |
| AI              | Mistral AI                         |
| Speech-to-text  | ElevenLabs Scribe                  |
| Text-to-speech  | ElevenLabs                         |
| Database        | PostgreSQL                         |
| Database client | `pg`                               |
| Authentication  | JWT + bcrypt                       |
| Styling         | Tailwind CSS                       |
| Video delivery  | Static files + nginx               |
| Process manager | pm2                                |
| Server          | Self-hosted Ubuntu                 |
| Deployment      | Self-hosted                        |

For more details about the project structure, API routes, database tables, authentication, and deployment, see [`DOCUMENTATION.md`](./DOCUMENTATION.md).

---

## Getting Started

### Prerequisites

You need:

* Node.js 20+
* PostgreSQL 13+
* A Mistral API key
* An ElevenLabs API key

nginx is only needed for the production deployment.

### Clone the project

```bash
git clone https://github.com/shahlajahangiri/HBK-Agent.git
cd HBK-Agent
npm install
```

### Configure the database

Create a PostgreSQL database and the required tables.

The main tables are:

* `users` — creator and admin accounts
* `agent` — agent configuration and ownership
* `videos` — videos belonging to each agent
* `knowledge_files` — uploaded knowledge files
* `settings` — platform-level settings

See the database schema below for the complete structure.

### Environment variables

Create your local environment file:

```bash
cp .env.example .env.local
```

Then add your Mistral, ElevenLabs, PostgreSQL, and JWT configuration.

### Run locally

```bash
npm run dev
```

Then open:

```text
http://localhost:3000/creator
```

Log in with your creator/admin account and create your first agent.

---

## Production

The application runs on a self-hosted Ubuntu server.

Next.js is managed with **pm2**, while nginx handles the incoming requests and serves uploaded videos directly.

### Build

```bash
npm run build
```

### Start with pm2

```bash
pm2 start npm --name agentstage -- start
pm2 save
```

Uploaded videos are served through nginx from:

```text
/videos/
```

For the complete nginx configuration and troubleshooting instructions, see [`DOCUMENTATION.md`](./DOCUMENTATION.md).

---

## Project Structure

For a detailed explanation of the project, including the individual files, API routes, database schema, authentication, and known limitations, see:

[`DOCUMENTATION.md`](./DOCUMENTATION.md)

---

## About the Project

AgentStage was created during the **Media Infrastructures** lecture at the **Hochschule der Bildenden Künste Saar (HBKsaar)** in the **Summer Semester 2026**.

**Supervised by Prof. Dr. Michael Schmitz.**

The project explores how voice interaction, conversational AI, and video-based characters can be combined to create a more interactive experience for visitors.

---

---

## Credits

**Developed by:** Arezoo Hassannezhad & Shahla Jahangiri  
**Hochschule:** Hochschule der Bildenden Künste Saar (HBKsaar)  
**Lecture:** Media Infrastructures  
**Semester:** Summer Semester 2026  
**Supervised by:** Prof. Dr. Michael Schmitz
