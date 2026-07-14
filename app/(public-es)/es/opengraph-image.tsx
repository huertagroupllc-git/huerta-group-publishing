import { ImageResponse } from "next/og";
import { MARK_DATA_URI } from "@/components/brand/mark-inline";

export const alt =
  "Huerta Group Publishing — Desarrolle libros, no solo manuscritos.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The Spanish social card (Phase M2 preview): the same flat brand system
 *  as the English card — warm paper, ink, the HG mark, one gold rule — with
 *  Spanish positioning. Built-in font, self-contained mark data URI; no
 *  hero-image dependency. The English card is unchanged. */
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
          padding: "72px 80px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img src={MARK_DATA_URI} width={104} height={104} alt="" />
          <div
            style={{
              display: "flex",
              fontSize: 26,
              letterSpacing: "0.2em",
              color: "#221d16",
            }}
          >
            HUERTA GROUP PUBLISHING
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              width: 120,
              height: 4,
              backgroundColor: "#9a7b2d",
              marginBottom: 36,
            }}
          />
          <div
            style={{
              display: "flex",
              fontSize: 72,
              lineHeight: 1.05,
              fontWeight: 600,
              color: "#221d16",
              maxWidth: 1000,
            }}
          >
            Desarrolle libros, no solo manuscritos.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, color: "#6b6153" }}>
          Un sistema operativo para autores
        </div>
      </div>
    ),
    { ...size },
  );
}
