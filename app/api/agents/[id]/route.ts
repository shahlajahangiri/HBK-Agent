import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { toScene } from "@/lib/scene-mapper";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const agentResult = await pool.query("SELECT * FROM agent WHERE id = $1", [id]);
  if (agentResult.rows.length === 0) return Response.json({ error: "not found" }, { status: 404 });

  const agent = agentResult.rows[0];
  if (agent.owner_id !== user.id && !user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const videosResult = await pool.query(
    "SELECT video_order, label, description, file_path, trigger, includes_speech, muted FROM videos WHERE agent_id = $1 ORDER BY video_order ASC",
    [agent.id]
  );

  return Response.json({ id: agent.id, ...toScene(agent, videosResult.rows) });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const agentResult = await pool.query("SELECT owner_id FROM agent WHERE id = $1", [id]);
  if (agentResult.rows.length === 0) return Response.json({ error: "not found" }, { status: 404 });

  const agent = agentResult.rows[0];
  if (agent.owner_id !== user.id && !user.isAdmin) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  await pool.query("DELETE FROM agent WHERE id = $1", [id]);
  return Response.json({ success: true });
}
