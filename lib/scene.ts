export interface VideoClip {
  index: number;
  url: string;
  label: string;
  description?: string;
  /** If true: speak first, then play the video */
  includesSpeech?: boolean;
  /** "entering" plays once when conversation starts, "leaving" plays on bye/timeout */
  trigger?: "entering" | "leaving";
  /** If true, this clip always plays muted regardless of the visitor's global sound toggle */
  muted?: boolean;
}

export interface Scene {
  id?: number;
  name: string;
  characterName: string;
  systemPrompt: string;
  idleMessage: string;
  selectionPrompt: string;
  videos: VideoClip[];
  orientation: "portrait" | "landscape" | "auto";
  showBotText: boolean;
  idleVideoIndex: number;
  slug?: string;
  /** ElevenLabs voice — falls back to ELEVENLABS_VOICE_ID env var if unset */
  voiceId?: string;
  voiceName?: string;
}

// Generic emergency fallback only — used as the initial render before a real
// agent loads, and if a slug/agent can't be found. Every real agent's actual
// content lives in the database (see lib/load-scene.ts), not here.
export const scene: Scene = {
  name: "",
  characterName: "",
  idleMessage: "Hi! Ask me anything.",
  systemPrompt: "You are a friendly, helpful guide. Keep replies to one or two short sentences — this is a voice conversation. Always reply in the same language the visitor used.",

  selectionPrompt: `Read the chatbot reply below and pick the best video.
Reply with ONLY a single number — nothing else.

1 = idle / waiting (no one is talking)
2 = happy, enthusiastic, welcoming, or positive answer
3 = serious, detailed explanation or complex answer
4 = greeting or farewell
5 = anything else / general talking`,

  videos: [],

  orientation: "auto",
  idleVideoIndex: 1,
  showBotText: true,
};
