import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const result = await pool.query(
    "SELECT id, name, character_name, slug, updated_at FROM agent WHERE owner_id = $1 ORDER BY updated_at DESC",
    [user.id]
  );
  return Response.json(result.rows);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "New Agent";
  const slugBase =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent";

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    return Response.json(
      { error: `Database connection failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }

  try {
    let slug = slugBase;
    let n = 1;
    while ((await client.query("SELECT id FROM agent WHERE slug = $1", [slug])).rows.length > 0) {
      n += 1;
      slug = `${slugBase}-${n}`;
    }

    const result = await client.query(
      `INSERT INTO agent (name, character_name, slug, owner_id, orientation, show_bot_text, idle_video_index, updated_at)
       VALUES ($1, $2, $3, $4, 'auto', true, 0, now())
       RETURNING id, slug`,
      [name, name, slug, user.id]
    );

    return Response.json(result.rows[0]);
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "create failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
