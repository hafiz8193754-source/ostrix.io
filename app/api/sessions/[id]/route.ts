import { NextResponse } from "next/server";
import { getUserFromRequest, renameSession, deleteSession } from "@/lib/serverAuth";
import { sessionRenameSchema } from "@/lib/schemas";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await request.json();
  const parsed = sessionRenameSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid title." }, { status: 400 });

  const session = await renameSession(user.id, params.id, parsed.data.title);
  if (!session) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  return NextResponse.json({ session });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const ok = await deleteSession(user.id, params.id);
  if (!ok) return NextResponse.json({ error: "Could not delete session." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
