import { NextRequest } from "next/server";
import bcrypt from "bcrypt";
import pool from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const targetId = Number(id);

  if (targetId === user.id) {
    return Response.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const agentCount = await pool.query("SELECT COUNT(*)::int AS n FROM agent WHERE owner_id = $1", [targetId]);
  if (agentCount.rows[0].n > 0) {
    return Response.json(
      { error: `This creator still owns ${agentCount.rows[0].n} agent(s). Delete or reassign those first.` },
      { status: 409 }
    );
  }

  const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [targetId]);
  if (result.rows.length === 0) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json({ success: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isAdmin) return Response.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  if (password.length < 6) {
    return Response.json({ error: "password must be at least 6 characters" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await pool.query(
    "UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id",
    [passwordHash, id]
  );
  if (result.rows.length === 0) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json({ success: true });
}
