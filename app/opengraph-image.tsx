import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Ostrix — See a doctor from home";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#0B2A27",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "#FF8C00",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              color: "#0A0A0A",
            }}
          >
            O
          </div>
          <div style={{ fontSize: 84, fontWeight: 700 }}>Ostrix</div>
        </div>
        <div style={{ marginTop: 36, fontSize: 40, color: "#FFB800" }}>See a doctor from home.</div>
      </div>
    ),
    size
  );
}
