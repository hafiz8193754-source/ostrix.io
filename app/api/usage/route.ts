import { NextResponse } from "next/server";
import { getUserFromRequest, getUsage } from "@/lib/serverAuth";

export async function GET(request: Request) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const builderLimit = parseInt(process.env.FREE_DAILY_BUILDS || "3", 10);
  const farmLimit = parseInt(process.env.FREE_DAILY_PLANS || "3", 10);
  const usage = await getUsage(user.id, builderLimit, farmLimit);
  return NextResponse.json({ usage });
}
