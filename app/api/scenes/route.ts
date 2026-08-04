import { NextRequest } from "next/server";
import pool from "@/lib/db";

export async function POST(req: NextRequest) {
  const scene = await req.json();
  const { name, characterName, systemPrompt, idleMessage, selectionPrompt,
          orientation, showBotText, idleVideoIndex, videos, voiceId, voiceName } = scene;

  if (!name) return Response.json({ error: "name required" }, { status: 400 });

  const slug = scene.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-scene";

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    return Response.json(
      { error: `Database connection failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 },
    );
  }

  try {
    await client.query("BEGIN");

    // Only one agent is ever allowed to exist. Renaming the scene must never create
    // a second row — always update whichever single row already exists, if any.
    const existing = await client.query("SELECT id FROM agent ORDER BY updated_at DESC LIMIT 1");

    let agentResult;
    if (existing.rows.length > 0) {
      const agentId = existing.rows[0].id;
      agentResult = await client.query(
        `UPDATE agent SET
           name = $1, character_name = $2, system_prompt = $3, idle_message = $4,
           selection_prompt = $5, orientation = $6, show_bot_text = $7, idle_video_index = $8,
           slug = $9, voice_id = $10, voice_name = $11, updated_at = now()
         WHERE id = $12
         RETURNING id, slug`,
        [name, characterName, systemPrompt, idleMessage, selectionPrompt, orientation, showBotText, idleVideoIndex, slug, voiceId ?? null, voiceName ?? null, agentId]
      );
    } else {
      agentResult = await client.query(
        `INSERT INTO agent (name, character_name, system_prompt, idle_message, selection_prompt, orientation, show_bot_text, idle_video_index, slug, voice_id, voice_name, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
         RETURNING id, slug`,
        [name, characterName, systemPrompt, idleMessage, selectionPrompt, orientation, showBotText, idleVideoIndex, slug, voiceId ?? null, voiceName ?? null]
      );
    }

    const agentId = agentResult.rows[0].id;

    await client.query("DELETE FROM videos WHERE agent_id = $1", [agentId]);

    for (const v of (videos ?? [])) {
      await client.query(
        `INSERT INTO videos (agent_id, video_order, label, description, file_path, trigger, includes_speech, muted)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [agentId, v.index, v.label, v.description ?? null, v.url, v.trigger ?? null, v.includesSpeech ?? false, v.muted ?? false]
      );
    }

    await client.query("COMMIT");
    return Response.json({ slug: agentResult.rows[0].slug });
  } catch (err) {
    await client.query("ROLLBACK");
    return Response.json({ error: err instanceof Error ? err.message : "save failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
