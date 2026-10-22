// Server helpers for the in-app WebRTC visit room and voice notes.
import { createHmac } from "crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAppointmentWithParties } from "@/lib/clinical";

export const AUDIO_BUCKET = "consultation-audio";
export const MAX_VISIT_AUDIO_BYTES = 24 * 1024 * 1024;

export type VisitParties = NonNullable<Awaited<ReturnType<typeof getAppointmentWithParties>>>;
export type VisitRole = "doctor" | "patient";

// Only this appointment's doctor or patient may join. Returns null otherwise.
export async function authorizeVisit(db: SupabaseClient, user: User, appointmentId: string): Promise<{ parties: VisitParties; role: VisitRole } | null> {
  const parties = await getAppointmentWithParties(db, appointmentId);
  if (!parties) return null;
  if (parties.doctor.user_id === user.id) return { parties, role: "doctor" };
  if (parties.patient.user_id === user.id) return { parties, role: "patient" };
  return null;
}

// The Realtime signaling channel name is an unguessable HMAC handed only to
// authorised parties, so knowing an appointment id is not enough to listen in.
export function visitRoomKey(appointmentId: string): string {
  const secret = process.env.VISIT_ROOM_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "ostrix-dev";
  return createHmac("sha256", secret).update(`visit:${appointmentId}`).digest("hex").slice(0, 32);
}

// STUN-only by default (no TURN => some strict/symmetric-NAT networks fail).
// Add a TURN server later without code changes:
//   VISIT_TURN_URLS="turn:turn.example.com:3478,turns:turn.example.com:5349"
//   VISIT_TURN_USERNAME=... VISIT_TURN_CREDENTIAL=...
// or replace everything with VISIT_ICE_SERVERS='[{"urls":"..."}]' (JSON).
export function iceServers(): RTCIceServer[] {
  const json = process.env.VISIT_ICE_SERVERS?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {
      // fall through to defaults
    }
  }
  const servers: RTCIceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  const turn = process.env.VISIT_TURN_URLS?.trim();
  if (turn) {
    servers.push({
      urls: turn.split(",").map((s) => s.trim()).filter(Boolean),
      username: process.env.VISIT_TURN_USERNAME?.trim(),
      credential: process.env.VISIT_TURN_CREDENTIAL?.trim(),
    });
  }
  return servers;
}

export function displayDoctorName(name: string): string {
  return `Dr. ${name.replace(/^\s*dr\.?\s+/i, "")}`;
}

export function intakeSummaryFrom(raw: unknown, symptoms?: string | null): string | null {
  const parts: string[] = [];
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (typeof r.triage_summary === "string") parts.push(`AI triage: ${r.triage_summary}`);
    const intake = r.intake as Record<string, unknown> | undefined;
    if (intake && typeof intake === "object")
      parts.push(
        Object.entries(intake)
          .filter(([k, v]) => k !== "triage_summary" && v !== null && v !== "" && v !== undefined)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ")
      );
  }
  if (!parts.length && symptoms) parts.push(`symptoms: ${symptoms}`);
  return parts.filter(Boolean).join("\n") || null;
}
