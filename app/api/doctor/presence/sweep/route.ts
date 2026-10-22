import { NextResponse } from "next/server";
import { runPresenceSweep } from "@/lib/presenceSweep";
import { hasServiceRoleKey, SERVER_NOT_CONFIGURED } from "@/lib/serverAuth";

export async function POST() {
  if (!hasServiceRoleKey()) return NextResponse.json({ error: SERVER_NOT_CONFIGURED }, { status: 503 });
  const result = await runPresenceSweep();
  return NextResponse.json(result);
}
