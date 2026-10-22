import { NextResponse } from "next/server";
import { createAnonAuthClient } from "@/lib/serverAuth";
import { getBankDetails, hasBankDetails } from "@/lib/payments";

// Public: the bank account patients transfer into (Bank Transfer is the only method).
export async function GET() {
  const bank = await getBankDetails(createAnonAuthClient());
  return NextResponse.json({ bank, configured: hasBankDetails(bank) });
}
