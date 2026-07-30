import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const incoming = await req.formData();
  const file = incoming.get("audio");

  if (!file || !(file instanceof File)) {
    return Response.json({ error: "No audio file provided" }, { status: 400 });
  }

  const forwardData = new FormData();
  forwardData.append("model_id", "scribe_v1");
  forwardData.append("file", file, "audio.webm");
  // language_code omitted on purpose — Scribe auto-detects the spoken language

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey! },
    body: forwardData,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return Response.json({ error: `ElevenLabs STT error: ${detail}` }, { status: 502 });
  }

  const data = await res.json();
  return Response.json({
    text: data.text ?? "",
    languageCode: data.language_code ?? null,
  });
}
