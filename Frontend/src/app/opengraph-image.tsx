import { ImageResponse } from "next/og";

// Site-wide Open Graph card. Cream-on-obsidian to match the marketing surface;
// the thin gold rule is imagery light (the one place gold is allowed). No
// external font is loaded, so this renders in next/og's default face — clean
// and branded without a build-time font fetch.
export const alt =
  "Kironyx: your brand and your rivals, seen through one lens";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0E0D0C",
          padding: "76px 80px",
          color: "#E1D9C1",
        }}
      >
        {/* Masthead row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 22,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "#A89F8A",
          }}
        >
          <div style={{ display: "flex" }}>Competitive self-awareness</div>
          <div style={{ display: "flex", fontWeight: 700, color: "#E1D9C1" }}>
            KIRONYX
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", height: 3, width: 96, background: "#F59E0B" }} />
          <div
            style={{
              display: "flex",
              marginTop: 36,
              fontSize: 74,
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: 900,
            }}
          >
            Your brand and your rivals, seen through one lens.
          </div>
        </div>

        {/* Standfirst */}
        <div
          style={{
            display: "flex",
            fontSize: 27,
            lineHeight: 1.4,
            color: "#A89F8A",
            maxWidth: 940,
          }}
        >
          The same deep research on you and on the field, and the gap between
          them, filed in one brief every Monday.
        </div>
      </div>
    ),
    { ...size },
  );
}
