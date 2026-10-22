import { NextResponse } from "next/server";
import { runPresenceSweep } from "@/lib/presenceSweep";

export async function POST() {
  const result = await runPresenceSweep();
  return NextResponse.json(result);
}
