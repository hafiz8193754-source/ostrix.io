"use client";

import { useState } from "react";
import { Copy, ExternalLink, Loader2, MapPin, MessageCircle, Navigation, Phone, Star } from "lucide-react";

type Pharmacy = {
  id: string; name: string; address: string | null; phone: string | null; whatsapp: string | null;
  open_now: boolean | null; opening_hours: string | null; rating: number | null; distance_km: number; maps_url: string; source: string;
};

export function PharmacyFinder({ accessToken, medicineList }: { accessToken: string; medicineList: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [place, setPlace] = useState("");
  const [result, setResult] = useState<{ source: string; radius_km: number; pharmacies: Pharmacy[]; center: { label: string | null } } | null>(null);
  const [copied, setCopied] = useState(false);

  async function search(params: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/pharmacies?${params}`, { headers: { authorization: `Bearer ${accessToken}` } });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Search failed.");
      setResult(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function locate() {
    setOpen(true);
    if (!navigator.geolocation) return setError("Location isn't available — type your area below.");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (p) => search(`lat=${p.coords.latitude.toFixed(5)}&lng=${p.coords.longitude.toFixed(5)}`),
      () => {
        setLoading(false);
        setError("Location permission denied — type your area and city below instead.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }

  async function copyList() {
    await navigator.clipboard.writeText(medicineList).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div data-testid="pharmacy-finder" className="flex flex-col gap-3 print:hidden">
      <div className="flex flex-wrap gap-2">
        <button data-testid="find-pharmacy" onClick={locate} className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-medium text-black">
          <MapPin className="h-3.5 w-3.5" /> Find nearby pharmacy
        </button>
        <button data-testid="copy-medicines" onClick={copyList} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-medium text-text-secondary">
          <Copy className="h-3.5 w-3.5" /> {copied ? "Copied!" : "Copy medicine list"}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-bg-elevated p-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (place.trim()) search(`q=${encodeURIComponent(place.trim())}`);
            }}
          >
            <input data-testid="pharmacy-place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Or type area, city — e.g. Gulberg, Lahore" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-bg-surface px-2.5 text-xs text-text-primary outline-none focus:border-accent" />
            <button className="h-9 rounded-md border border-accent px-3 text-xs font-medium text-accent">Search</button>
          </form>
          <p className="rounded-md bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800">Call the pharmacy to confirm stock and home delivery. Listings come from {result?.source === "google" ? "Google Maps" : "OpenStreetMap"} and may be incomplete.</p>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-text-muted" />}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {result && !loading && (
            <>
              <p className="text-[11px] text-text-muted">
                {result.pharmacies.length} pharmacies within {result.radius_km} km{result.center.label ? ` of ${result.center.label.split(",").slice(0, 3).join(",")}` : ""}.
              </p>
              <ul className="flex flex-col gap-2">
                {result.pharmacies.map((p) => (
                  <li key={p.id} data-testid="pharmacy-item" className="flex flex-col gap-1 rounded-lg border border-border bg-bg-surface p-2.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-text-primary">{p.name}</p>
                      <span className="shrink-0 text-text-muted">{p.distance_km < 1 ? `${Math.round(p.distance_km * 1000)} m` : `${p.distance_km.toFixed(1)} km`}</span>
                    </div>
                    <p className="text-text-secondary">{p.address || "Address not listed"}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-text-muted">
                      {p.open_now !== null && <span className={p.open_now ? "text-green-700" : "text-red-600"}>{p.open_now ? "Open now" : "Closed now"}</span>}
                      {p.opening_hours && <span>Hours: {p.opening_hours}</span>}
                      {p.rating !== null && <span className="flex items-center gap-0.5"><Star className="h-3 w-3" />{p.rating}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {p.phone ? (
                        <a data-testid="pharmacy-call" href={`tel:${p.phone.split(/[;,/]/)[0].replace(/[^\d+]/g, "")}`} className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 font-medium text-black">
                          <Phone className="h-3 w-3" /> {p.phone.split(/[;,/]/)[0].trim()}
                        </a>
                      ) : (
                        <span className="rounded-md bg-bg-elevated px-2.5 py-1 text-text-muted">Phone not listed</span>
                      )}
                      {p.whatsapp && (
                        <a href={`https://wa.me/${p.whatsapp}?text=${encodeURIComponent(`Assalam o alaikum, do you have these medicines and home delivery?\n${medicineList}`)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md border border-green-600 px-2.5 py-1 font-medium text-green-700">
                          <MessageCircle className="h-3 w-3" /> WhatsApp
                        </a>
                      )}
                      <a href={p.maps_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-text-secondary">
                        <Navigation className="h-3 w-3" /> Directions <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
              {result.source === "openstreetmap" && <p className="text-[10px] text-text-muted">Map data © OpenStreetMap contributors (ODbL).</p>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
