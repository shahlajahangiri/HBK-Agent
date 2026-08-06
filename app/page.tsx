import { redirect } from "next/navigation";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const result = await pool.query("SELECT value FROM settings WHERE key = 'default_agent_slug'");
  const slug = result.rows[0]?.value as string | null | undefined;

  if (slug) {
    redirect(`/${slug}`);
  }

  return (
    <main className="flex h-screen items-center justify-center bg-black text-white/70">
      <p className="text-sm tracking-wide">
        Please use the link provided for your exhibition guide.
      </p>
    </main>
  );
}
