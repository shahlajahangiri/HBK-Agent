import { NextRequest } from "next/server";

export const runtime = "edge";

// Languages the fast flash model can actually speak (ISO 639-3, as reported by Scribe).
// Anything outside this set gets the slower but far more multilingual eleven_v3 model —
// e.g. Persian comes out with a Pashto-like accent on flash but sounds native on v3.
const FLASH_LANGUAGES = new Set([
  "eng", "deu", "fra", "spa", "ita", "por", "nld", "pol", "swe", "dan", "nor",
  "fin", "ces", "slk", "ukr", "rus", "bul", "ron", "ell", "hun", "hrv", "tur",
  "ara", "hin", "tam", "ind", "msa", "fil", "vie", "jpn", "kor", "zho",
]);

export async function POST(req: NextRequest) {
  const { text, voiceId: voiceIdOverride, language } = await req.json();

  const voiceId = voiceIdOverride || process.env.ELEVENLABS_VOICE_ID;
  const apiKey = process.env.ELEVENLABS_API_KEY;

  const modelId =
    language && !FLASH_LANGUAGES.has(language) ? "eleven_v3" : "eleven_flash_v2_5";

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    return new Response("ElevenLabs error", { status: 502 });
  }

  return new Response(res.body, {
    headers: { "Content-Type": "audio/mpeg" },
  });
}
