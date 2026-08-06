import { NextRequest } from "next/server";
import bcrypt from "bcrypt";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

  const result = await pool.query(
    `SELECT u.id, u.username, u.is_admin, u.created_at,
            COUNT(a.id)::int AS agent_count
     FROM users u
     LEFT JOIN agent a ON a.owner_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at ASC`
  );
  return Response.json(result.rows);
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return Response.json({ error: "username and password are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "password must be at least 6 characters" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      "INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, is_admin, created_at",
      [username, passwordHash]
    );
    return Response.json(result.rows[0]);
  } catch (err: any) {
    if (err?.code === "23505") {
      return Response.json({ error: "That username is already taken." }, { status: 409 });
    }
    return Response.json({ error: err instanceof Error ? err.message : "create failed" }, { status: 500 });
  }
}
