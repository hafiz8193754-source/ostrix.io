// Nearby pharmacy lookup. Google Places when GOOGLE_MAPS_API_KEY is set,
// otherwise OpenStreetMap (Overpass + Nominatim). Data comes only from these
// sources — never generated — and a missing phone is reported as missing.
export interface Pharmacy {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  open_now: boolean | null;
  opening_hours: string | null;
  rating: number | null;
  lat: number;
  lng: number;
  distance_km: number;
  maps_url: string;
  source: "google" | "openstreetmap";
}

const UA = "Ostrix/1.0 (telehealth pharmacy finder; https://ostrix-io.vercel.app)";
const cache = new Map<string, { at: number; value: unknown }>();
const TTL = 15 * 60 * 1000;
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
  return value;
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(s)) * 100) / 100;
}

// Pakistani mobile numbers: 03XX-XXXXXXX / +92 3XX XXXXXXX. Landlines (e.g. 042-…) get no WhatsApp link.
export function whatsappFor(phone: string | null): string | null {
  if (!phone) return null;
  const first = phone.split(/[;,/]/)[0];
  let d = first.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0092")) d = d.slice(2);
  if (d.startsWith("03") && d.length === 11) d = `92${d.slice(1)}`;
  return /^923\d{9}$/.test(d) ? d : null;
}

function mapsUrl(lat: number, lng: number, name: string, placeId?: string) {
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("destination", `${lat},${lng}`);
  if (placeId) u.searchParams.set("destination_place_id", placeId);
  void name;
  return u.toString();
}

export async function geocode(q: string): Promise<{ lat: number; lng: number; label: string } | null> {
  return cached(`geo:${q.toLowerCase()}`, async () => {
    const u = new URL("https://nominatim.openstreetmap.org/search");
    u.searchParams.set("q", q);
    u.searchParams.set("format", "jsonv2");
    u.searchParams.set("limit", "1");
    u.searchParams.set("countrycodes", "pk");
    const res = await fetch(u, { headers: { "user-agent": UA, "accept-language": "en" }, next: { revalidate: 86400 } });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as { lat: string; lon: string; display_name: string }[];
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), label: hit.display_name } : null;
  });
}

async function fromGoogle(lat: number, lng: number, key: string): Promise<Pharmacy[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.currentOpeningHours.openNow,places.rating,places.location",
    },
    body: JSON.stringify({ includedTypes: ["pharmacy"], maxResultCount: 20, rankPreference: "DISTANCE", locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: 5000 } } }),
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}`);
  const data = (await res.json()) as { places?: Record<string, any>[] }; // eslint-disable-line @typescript-eslint/no-explicit-any
  return (data.places || []).map((p) => {
    const plat = p.location?.latitude, plng = p.location?.longitude;
    const phone = p.internationalPhoneNumber || p.nationalPhoneNumber || null;
    return {
      id: `g:${p.id}`,
      name: p.displayName?.text || "Pharmacy",
      address: p.formattedAddress || null,
      phone,
      whatsapp: whatsappFor(phone),
      open_now: typeof p.currentOpeningHours?.openNow === "boolean" ? p.currentOpeningHours.openNow : null,
      opening_hours: null,
      rating: typeof p.rating === "number" ? p.rating : null,
      lat: plat,
      lng: plng,
      distance_km: distanceKm({ lat, lng }, { lat: plat, lng: plng }),
      maps_url: mapsUrl(plat, plng, p.displayName?.text || "", p.id),
      source: "google" as const,
    };
  });
}

const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];

async function fromOsm(lat: number, lng: number, radius: number): Promise<Pharmacy[]> {
  const q = `[out:json][timeout:7];(node["amenity"="pharmacy"](around:${radius},${lat},${lng});way["amenity"="pharmacy"](around:${radius},${lat},${lng});node["healthcare"="pharmacy"](around:${radius},${lat},${lng}););out center tags 80;`;
  let lastErr: unknown;
  for (const endpoint of OVERPASS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "user-agent": UA, accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(q)}`,
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const data = (await res.json()) as { elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] };
      const seen = new Set<string>();
      return data.elements
        .map((e): Pharmacy | null => {
          const t = e.tags || {};
          const plat = e.lat ?? e.center?.lat, plng = e.lon ?? e.center?.lon;
          if (plat === undefined || plng === undefined) return null;
          const addr = [t["addr:housenumber"], t["addr:street"], t["addr:suburb"] || t["addr:neighbourhood"], t["addr:city"]].filter(Boolean).join(", ") || t["addr:full"] || null;
          const phone = t.phone || t["contact:phone"] || t["contact:mobile"] || t.mobile || null;
          const name = t.name || t["name:en"] || t.brand || "Unnamed pharmacy";
          return {
            id: `osm:${e.type}/${e.id}`,
            name,
            address: addr,
            phone,
            whatsapp: whatsappFor(t["contact:whatsapp"] || phone),
            open_now: null,
            opening_hours: t.opening_hours || null,
            rating: null,
            lat: plat,
            lng: plng,
            distance_km: distanceKm({ lat, lng }, { lat: plat, lng: plng }),
            maps_url: mapsUrl(plat, plng, name),
            source: "openstreetmap" as const,
          };
        })
        .filter((p): p is Pharmacy => {
          if (!p) return false;
          const k = `${p.name.toLowerCase()}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Overpass unavailable");
}

// Last-resort OSM source when every Overpass mirror is down/slow: Nominatim
// amenity search bounded to a box around the point (same OSM data, fewer tags).
async function fromNominatim(lat: number, lng: number, radiusKm: number): Promise<Pharmacy[]> {
  const dLat = radiusKm / 111, dLng = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", "pharmacy");
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "40");
  u.searchParams.set("extratags", "1");
  u.searchParams.set("addressdetails", "1");
  u.searchParams.set("bounded", "1");
  u.searchParams.set("viewbox", `${lng - dLng},${lat + dLat},${lng + dLng},${lat - dLat}`);
  const res = await fetch(u, { headers: { "user-agent": UA, "accept-language": "en" }, signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const rows = (await res.json()) as { osm_type: string; osm_id: number; lat: string; lon: string; name: string; display_name: string; extratags?: Record<string, string>; address?: Record<string, string> }[];
  return rows.map((r) => {
    const plat = Number(r.lat), plng = Number(r.lon);
    const t = r.extratags || {};
    const a = r.address || {};
    const phone = t.phone || t["contact:phone"] || t["contact:mobile"] || null;
    const name = r.name || "Unnamed pharmacy";
    return {
      id: `osm:${r.osm_type}/${r.osm_id}`,
      name,
      address: [a.house_number, a.road, a.suburb || a.neighbourhood, a.city || a.town].filter(Boolean).join(", ") || null,
      phone,
      whatsapp: whatsappFor(t["contact:whatsapp"] || phone),
      open_now: null,
      opening_hours: t.opening_hours || null,
      rating: null,
      lat: plat,
      lng: plng,
      distance_km: distanceKm({ lat, lng }, { lat: plat, lng: plng }),
      maps_url: mapsUrl(plat, plng, name),
      source: "openstreetmap" as const,
    };
  }).filter((p) => p.distance_km <= radiusKm * 1.2);
}

export async function findPharmacies(lat: number, lng: number): Promise<{ source: string; radius_km: number; pharmacies: Pharmacy[] }> {
  const rl = Math.round(lat * 1000) / 1000, rg = Math.round(lng * 1000) / 1000; // ~100 m cache cells
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  return cached(`ph:${key ? "g" : "o"}:${rl},${rg}`, async () => {
    if (key) {
      try {
        const list = await fromGoogle(lat, lng, key);
        return { source: "google", radius_km: 5, pharmacies: list.sort((a, b) => a.distance_km - b.distance_km) };
      } catch {
        // fall through to OSM
      }
    }
    let list: Pharmacy[];
    let radius = 5;
    try {
      list = await fromOsm(lat, lng, 5000);
      // Prefer the closer 3 km set when it already has enough results.
      const near = list.filter((p) => p.distance_km <= 3);
      if (near.length >= 8) {
        list = near;
        radius = 3;
      }
    } catch {
      list = await fromNominatim(lat, lng, 5);
    }
    // Nearest first; within each 1 km band, pharmacies with a phone come first.
    list.sort((a, b) => Math.floor(a.distance_km) - Math.floor(b.distance_km) || (a.phone ? 0 : 1) - (b.phone ? 0 : 1) || a.distance_km - b.distance_km);
    return { source: "openstreetmap", radius_km: radius, pharmacies: list.slice(0, 25) };
  });
}
