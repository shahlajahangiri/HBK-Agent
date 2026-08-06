import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const result = await pool.query(
    "SELECT id, name, character_name, slug, updated_at FROM agent WHERE owner_id = $1 ORDER BY updated_at DESC",
    [id]
  );
  return Response.json(result.rows);
}
