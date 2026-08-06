import { NextRequest } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { getAuthUser } from "@/lib/auth";

const VIDEO_DIR = path.join(process.cwd(), "public", "videos");

// POST /api/upload — save a video file to disk. DB linkage to a specific
// agent happens later, when the creator hits Save (see /api/scenes).
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return Response.json({ error: "no file" }, { status: 400 });

  const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const publicPath = `/videos/${filename}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(VIDEO_DIR, filename), buffer);

  return Response.json({ url: publicPath, filename });
}
