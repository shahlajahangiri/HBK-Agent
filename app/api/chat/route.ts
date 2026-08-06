import { NextRequest } from "next/server";
import { loadScene } from "@/lib/load-scene";

const ALLOWED_MODELS = ["mistral-large-latest", "open-mistral-nemo"] as const;
type AllowedModel = (typeof ALLOWED_MODELS)[number];

export async function POST(req: NextRequest) {
  const { messages, model, slug } = await req.json();
  const scene = await loadScene(slug);

  const selectedModel: AllowedModel = ALLOWED_MODELS.includes(model)
    ? model
    : "mistral-large-latest";

  // Clips that aren't entering/leaving triggers and have a description are
  // eligible to be offered to the visitor (e.g. real student project videos).
  const offerableVideos = scene.videos.filter((v) => !v.trigger && v.description);
  const videoListPrompt = offerableVideos.length
    ? `\n\nYou have access to these real clips:\n${offerableVideos.map((v) => `${v.index}. ${v.description}`).join("\n")}\n\nIf one of these is clearly relevant to what the visitor just asked about, ask permission before showing it — mention specific details from the description. Never play it automatically.\nWhen you ask this kind of permission question, end your reply with the exact marker [[OFFER:<index>]] (using that clip's number) and nothing after it. Never explain or mention this marker to the visitor.\nIf nothing is relevant, don't use the marker at all.`
    : "";

  // Enforced in code, not in the editable knowledge prompt: the agent always answers in the
  // visitor's language. The transcript text itself is the primary signal (its script
  // rarely lies).
  const languageInstruction =
    `\n\nIMPORTANT: Write your entire reply in the language the visitor's last message is written in — never in any other language, no matter what language these instructions or the knowledge above are written in.` +
    `\nThe visitor's message comes from speech recognition, which can garble names and technical terms. If a word in the message plausibly sounds like a name or term from the knowledge above, silently correct it rather than asking what the garbled word means.` +
    `\nSpeech recognition also sometimes transcribes non-English speech as similar-sounding English (e.g. German "Wer ist …?" (Who is …?) becomes English "Where is …?"). If the visitor's question doesn't quite make sense literally, consider whether it's a mis-transcription of a similar-sounding phrase in another language, and answer what they most likely actually asked.`;

  // The model has no clock and its knowledge ends at its training cutoff — give it
  // today's real date and tell it to be honest about anything more recent.
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const dateInstruction = `\n\nToday's date is ${today}. Your training data ends earlier than this, so for events after your knowledge cutoff (elections, news, appointments), say you cannot know rather than guessing based on outdated information.`;

  const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: selectedModel,
      stream: true,
      max_tokens: 80,
      messages: [
        { role: "system", content: scene.systemPrompt + videoListPrompt + languageInstruction + dateInstruction },
        ...messages,
      ],
    }),
  });

  if (!res.ok) {
    return new Response("Mistral API error", { status: 502 });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Model": selectedModel,
    },
  });
}
