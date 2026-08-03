import { NextRequest } from "next/server";
import { loadScene } from "@/lib/load-scene";

const ALLOWED_MODELS = ["mistral-large-latest", "open-mistral-nemo"] as const;
type AllowedModel = (typeof ALLOWED_MODELS)[number];

export async function POST(req: NextRequest) {
  const { messages, model } = await req.json();
  const scene = await loadScene();

  const selectedModel: AllowedModel = ALLOWED_MODELS.includes(model)
    ? model
    : "mistral-large-latest";

  // Clips that aren't entering/leaving triggers and have a description are
  // eligible to be offered to the visitor (e.g. real student project videos).
  const offerableVideos = scene.videos.filter((v) => !v.trigger && v.description);
  const videoListPrompt = offerableVideos.length
    ? `

You have access to these real student project videos:
${offerableVideos.map((v) => `${v.index}. ${v.description}`).join("\n")}

If one of these is clearly relevant to what the visitor just asked about, ask permission before showing it — mention the student name, subject, or date if the description includes them. Never play it automatically.
When you ask this kind of permission question, end your reply with the exact marker [[OFFER:<index>]] (using that clip's number) and nothing after it. Never explain or mention this marker to the visitor.
If nothing is relevant, don't use the marker at all.`
    : "";

  // Enforced in code, not in the editable knowledge prompt: Mira always answers in the
  // visitor's language. The transcript text itself is the primary signal (its script
  // rarely lies); Scribe's detected language is passed only as a confirming hint,
  // since its guess can occasionally be wrong.
  // Note: Scribe's detected-language hint proved unreliable here (accented English was
  // confidently flagged as Swedish), so the message text alone decides the reply language.
  const languageInstruction =
    `\n\nIMPORTANT: Write your entire reply in the language the visitor's last message is written in — never in any other language, no matter what language these instructions or the knowledge above are written in.` +
    `\nAlways write the school's name exactly as "HBK Saar" — never abbreviate, shorten, or alter it.` +
    `\nThe visitor's message comes from speech recognition, which frequently garbles the name "HBK Saar" (seen as "HPK Czar", "K Saar", "HP Ksar", "HPK ZARP", "Kaserne", "کازار" and similar). If any word in the message plausibly sounds like it, silently treat it as "HBK Saar" — never ask what the garbled word means and never invent a different place.` +
    `\nSpeech recognition also sometimes transcribes German speech as similar-sounding English. Most common: German "Wer ist …?" (Who is …?) becomes English "Where is …?". If the visitor asks "Where is" about a PERSON, they almost certainly asked "Wer ist" — answer who that person is, in German. Likewise names may be slightly off ("Schmidt" for "Schmitz").`;

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