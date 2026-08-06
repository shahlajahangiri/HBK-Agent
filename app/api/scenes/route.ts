import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const scene = await req.json();
  const { id, name, characterName, systemPrompt, idleMessage, selectionPrompt,
          orientation, showBotText, idleVideoIndex, videos, voiceId, voiceName } = scene;

  if (!id) return Response.json({ error: "agent id required" }, { status: 400 });
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

    const existing = await client.query("SELECT owner_id FROM agent WHERE id = $1", [id]);
    if (existing.rows.length === 0) {
      await client.query("ROLLBACK");
      return Response.json({ error: "agent not found" }, { status: 404 });
    }
    if (existing.rows[0].owner_id !== user.id) {
      await client.query("ROLLBACK");
      return Response.json({ error: "forbidden" }, { status: 403 });
    }

    const agentResult = await client.query(
      `UPDATE agent SET
         name = $1, character_name = $2, system_prompt = $3, idle_message = $4,
         selection_prompt = $5, orientation = $6, show_bot_text = $7, idle_video_index = $8,
         slug = $9, voice_id = $10, voice_name = $11, updated_at = now()
       WHERE id = $12
       RETURNING id, slug`,
      [name, characterName, systemPrompt, idleMessage, selectionPrompt, orientation, showBotText, idleVideoIndex, slug, voiceId ?? null, voiceName ?? null, id]
    );

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
    return Response.json({ id: agentId, slug: agentResult.rows[0].slug });
  } catch (err: any) {
    await client.query("ROLLBACK");
    if (err?.code === "23505") {
      return Response.json({ error: "That URL is already taken — choose a different one." }, { status: 409 });
    }
    return Response.json({ error: err instanceof Error ? err.message : "save failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
