import { NextRequest } from "next/server";

export const runtime = "edge";

// Languages we plausibly expect at the exhibition. Scribe's auto-detection
// sometimes assigns short German utterances to wildly wrong languages (Russian,
// Persian script, …), and once the language is wrong the transcript is garbage.
// If detection lands outside this list — or is unsure — we re-transcribe the
// same audio forced to German, the exhibition's primary spoken language.
const EXPECTED_LANGUAGES = new Set([
  "eng", "deu", "fas", "per", "tur", "fra", "spa", "ita", "ara", "nld", "pol", "ukr",
]);
const MIN_CONFIDENCE = 0.8;

async function transcribe(apiKey: string, file: File, languageCode?: string) {
  const fd = new FormData();
  fd.append("model_id", "scribe_v2");
  fd.append("file", file, "audio.webm");
  if (languageCode) fd.append("language_code", languageCode);

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: fd,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs STT error: ${detail}`);
  }
  return res.json();
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const incoming = await req.formData();
  const file = incoming.get("audio");

  if (!file || !(file instanceof File)) {
    return Response.json({ error: "No audio file provided" }, { status: 400 });
  }

  try {
    let data = await transcribe(apiKey!, file);

    const detected: string | null = data.language_code ?? null;
    const confidence: number = data.language_probability ?? 0;
    const implausible =
      !detected || !EXPECTED_LANGUAGES.has(detected) || confidence < MIN_CONFIDENCE;

    if (implausible) {
      const retry = await transcribe(apiKey!, file, "deu");
      if ((retry.text ?? "").trim()) {
        data = retry;
        data.language_code = "deu";
      }
    }

    return Response.json({
      text: data.text ?? "",
      languageCode: data.language_code ?? null,
      languageProbability: data.language_probability ?? null,
    });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "STT failed" },
      { status: 502 },
    );
  }
}
