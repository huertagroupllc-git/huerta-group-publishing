import { ImageResponse } from "next/og";

export const alt =
  "Huerta Group Publishing — Develop books, not just manuscripts.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The social card: the brand palette (warm paper, ink, one oxblood rule)
 *  as a quiet typographic composition. Uses the built-in font so it never
 *  depends on an external fetch. */
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
          backgroundColor: "#f7f2e9",
          padding: "80px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 24,
            letterSpacing: "0.2em",
            color: "#6b6153",
          }}
        >
          HUERTA GROUP PUBLISHING
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              width: 96,
              height: 5,
              backgroundColor: "#6e2a2e",
              marginBottom: 36,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 78,
              lineHeight: 1.05,
              fontWeight: 600,
              color: "#221d16",
              maxWidth: 940,
            }}
          >
            Develop books, not just manuscripts.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#6b6153" }}>
          An Author Operating System
        </div>
      </div>
    ),
    { ...size },
  );
}
