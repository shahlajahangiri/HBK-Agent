import { NextRequest } from "next/server";

export const runtime = "edge";

interface ElevenLabsSharedVoice {
  voice_id: string;
  name: string;
  gender?: string;
  accent?: string;
  language?: string;
  description?: string;
  preview_url?: string;
  category?: string;
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const { searchParams } = new URL(req.url);

  const params = new URLSearchParams({ page_size: "30" });
  const search = searchParams.get("search");
  const gender = searchParams.get("gender");
  const accent = searchParams.get("accent");
  const language = searchParams.get("language");
  if (search) params.set("search", search);
  if (gender && gender !== "any") params.set("gender", gender);
  if (accent && accent !== "any") params.set("accent", accent);
  if (language && language !== "any") params.set("language", language);

  const res = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${params}`, {
    headers: { "xi-api-key": apiKey! },
  });

  if (!res.ok) {
    return Response.json({ error: "ElevenLabs error" }, { status: 502 });
  }

  const data = await res.json();
  const voices = ((data.voices ?? []) as ElevenLabsSharedVoice[]).map((v) => ({
    voiceId: v.voice_id,
    name: v.name,
    gender: v.gender ?? "unknown",
    accent: v.accent ?? "unknown",
    language: v.language ?? "unknown",
    description: v.description ?? "",
    previewUrl: v.preview_url ?? "",
  }));

  return Response.json({ voices });
}
