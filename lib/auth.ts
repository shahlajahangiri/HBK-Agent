import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import pool from "@/lib/db";

export interface AuthUser {
  id: number;
  username: string;
  isAdmin: boolean;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: number; username: string };
    const result = await pool.query("SELECT is_admin FROM users WHERE id = $1", [payload.id]);
    if (result.rows.length === 0) return null;
    return { id: payload.id, username: payload.username, isAdmin: result.rows[0].is_admin };
  } catch {
    return null;
  }
}
