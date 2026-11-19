import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { getBankDetails, hasBankDetails } from "@/lib/payments";

// Signed-in patients only. The account number is not a public directory field.
export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const bank = await getBankDetails(auth.db);
  return NextResponse.json({ bank, configured: hasBankDetails(bank) });
}
