import { NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { findPharmacies, geocode } from "@/lib/pharmacies";

export const maxDuration = 30;

// GET /api/pharmacies?lat=..&lng=..  or  ?q=Gulberg, Lahore
export async function GET(request: Request) {
  const auth = await getUserFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  let lat = Number(searchParams.get("lat"));
  let lng = Number(searchParams.get("lng"));
  let label: string | null = null;
  const q = searchParams.get("q")?.trim();
  if (q && (!Number.isFinite(lat) || !Number.isFinite(lng) || (!searchParams.get("lat") && !searchParams.get("lng")))) {
    if (q.length > 120) return NextResponse.json({ error: "Location text too long." }, { status: 400 });
    const g = await geocode(q).catch(() => null);
    if (!g) return NextResponse.json({ error: "Couldn't find that place. Try 'Area, City' e.g. 'Gulberg, Lahore'." }, { status: 404 });
    ({ lat, lng, label } = g);
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (!searchParams.get("lat") && !q))
    return NextResponse.json({ error: "Provide lat & lng, or a place name (q)." }, { status: 400 });
  try {
    const result = await findPharmacies(lat, lng);
    return NextResponse.json({ ...result, center: { lat, lng, label } });
  } catch {
    return NextResponse.json({ error: "The pharmacy map service is busy. Please try again in a minute." }, { status: 503 });
  }
}
