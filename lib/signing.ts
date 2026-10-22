// Prescription signing: canonical content hash + human-friendly verify code.
import { createHash, randomBytes } from "crypto";
import type { PrescriptionData } from "@/types";

// Stable JSON (sorted keys) so the same content always hashes the same.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export interface SignedPayload {
  prescription_id: string;
  version: number;
  doctor_id: string;
  pmdc_number: string | null;
  signed_at: string;
  content: PrescriptionData;
}

export function prescriptionHash(p: SignedPayload): string {
  return createHash("sha256").update(canonicalJson(p)).digest("hex");
}

// 10 chars from an unambiguous alphabet, shown as XXXXX-XXXXX.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function newVerifyCode(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
export function formatVerifyCode(code: string): string {
  return code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}
export function normalizeVerifyCode(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, "");
}
