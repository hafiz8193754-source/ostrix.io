"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Session as SupabaseSession } from "@supabase/supabase-js";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { PrescriptionCard } from "@/components/doctor/PrescriptionCard";
import type { Prescription } from "@/types";

// Clean printable prescription (browser "Save as PDF" friendly).
export default function PrintableRxPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [data, setData] = useState<{ prescription: Prescription; doctor: any; patient: any } | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace(`/login?next=${encodeURIComponent(`/rx/${id}`)}`);
      else setSession(data.session);
    });
  }, [router, id]);
  useEffect(() => {
    if (!session) return;
    fetch(`/api/prescriptions/${id}`, { headers: { authorization: `Bearer ${session.access_token}` } })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Not found.");
        if (d.prescription.status !== "approved") throw new Error("This prescription hasn't been signed yet.");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [session, id]);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 bg-white px-4 py-6 print:p-0">
      <Link href="/my-care" className="flex items-center gap-1 text-sm text-neutral-600 print:hidden">
        <ArrowLeft className="h-4 w-4" /> My care
      </Link>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />}
      {data && session && <PrescriptionCard prescription={data.prescription} doctor={data.doctor} patient={data.patient} accessToken={session.access_token} printable />}
    </div>
  );
}
