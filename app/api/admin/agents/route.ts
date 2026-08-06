import pool from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

// All agents system-wide, with owner username — admin-only, used to populate
// the "default agent for the root URL" picker.
export async function GET() {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

  const result = await pool.query(
    `SELECT a.id, a.name, a.slug, u.username AS owner_username
     FROM agent a
     JOIN users u ON u.id = a.owner_id
     ORDER BY a.name ASC`
  );
  return Response.json(result.rows);
}
