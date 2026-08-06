import { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

// GET is public — the root page needs to know where to redirect before anyone logs in.
export async function GET() {
  const result = await pool.query("SELECT value FROM settings WHERE key = 'default_agent_slug'");
  const slug = result.rows[0]?.value ?? null;
  return Response.json({ slug });
}

export async function PUT(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";

  if (slug) {
    const agent = await pool.query("SELECT id FROM agent WHERE slug = $1", [slug]);
    if (agent.rows.length === 0) {
      return Response.json({ error: "No agent found with that URL." }, { status: 404 });
    }
  }

  await pool.query(
    `INSERT INTO settings (key, value) VALUES ('default_agent_slug', $1::jsonb)
     ON CONFLICT (key) DO UPDATE SET value = $1::jsonb`,
    [JSON.stringify(slug || null)]
  );

  return Response.json({ slug: slug || null });
}
