import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalCoverProfileSerialization,
  coverProfileFingerprint,
  HGP_TRADE_6X9_COVER_V1,
} from "@/lib/publication/cover-profile";
import {
  computeWrapGeometry,
  CoverGeometryError,
  jpegIdentity,
} from "@/lib/publication/cover-geometry";
import {
  generateCoverPdf,
  COVER_SERIALIZER_VERSION,
} from "@/lib/publication/cover-serializer";
import { validatePdfStructure } from "@/lib/publication/print-validate";
import { validateCoverProduction } from "@/lib/publication/cover-validate";
import { UnsupportedContentError } from "@/lib/publication/print-representation";
import {
  PUBLISHER_IMPRINT,
  PUBLISHER_LEGAL_ENTITY,
} from "@/lib/publication/publisher";
import type { ConsumedMetadata } from "@/lib/publication/metadata-fingerprint";
import type { CandidateRecord } from "@/lib/publication/types";

/** Cover Production Phase 2 invariants: profile canon, deterministic
 *  wrap geometry, the hgp-cover serializer, and both validation
 *  gates. */

const profile = HGP_TRADE_6X9_COVER_V1;

describe("cover profile canon", () => {
  it("has the stable identifier, version, and pinned fingerprint", () => {
    expect(profile.profileKey).toBe("hgp-trade-6x9-cover");
    expect(profile.version).toBe(1);
    expect(profile.interiorProfileKey).toBe("hgp-trade-6x9-text");
    // Pinned: also seeded verbatim in migration 20260818000000. A
    // change here is a NEW profile version, never an edit.
    expect(coverProfileFingerprint(profile)).toBe(
      "d2ec1e06a53037303043813945f278a3614f27c6ca880d8a41549e3a8fd0b940",
    );
    expect(canonicalCoverProfileSerialization(profile)).toContain("3:444");
  });

  it("material change alters the fingerprint", () => {
    expect(
      coverProfileFingerprint({ ...profile, paperPpi: 445 }),
    ).not.toBe(coverProfileFingerprint(profile));
  });
});

describe("wrap geometry engine", () => {
  it("computes the spine deterministically from the paper rule", () => {
    const g = computeWrapGeometry(profile, 200);
    expect(g.spineWidth).toBe(Math.round((200 * 72000) / 444)); // 32432
    expect(g.spineWidth).toBe(32432);
    expect(g.wrapWidth).toBe(9000 * 2 + 432000 * 2 + 32432);
    expect(g.wrapHeight).toBe(648000 + 18000);
    expect(g.backPanelX).toBe(9000);
    expect(g.spineX).toBe(9000 + 432000);
    expect(g.frontPanelX).toBe(9000 + 432000 + 32432);
    expect(g.spineTextFits).toBe(true);
  });

  it("omits spine text below the threshold; refuses out-of-range counts", () => {
    expect(computeWrapGeometry(profile, 100).spineTextFits).toBe(false);
    expect(() => computeWrapGeometry(profile, 23)).toThrow(CoverGeometryError);
    expect(() => computeWrapGeometry(profile, 829)).toThrow(
      "page_count_out_of_range",
    );
  });

  it("identifies JPEG dimensions and components deterministically", () => {
    const jpeg = Buffer.from(TINY_JPEG, "base64");
    const identity = jpegIdentity(jpeg);
    expect(identity).toEqual({ width: 1, height: 1, components: 1 });
    expect(jpegIdentity(Buffer.from("not a jpeg"))).toBeNull();
  });
});

const record: CandidateRecord = {
  id: "0f0e0d0c-0b0a-4948-8746-454443424140",
  book_id: "b1",
  candidate_number: 1,
  disposition: "presented",
  frozen_title: "The Printed Hour",
  frozen_subtitle: "A Determinism",
  frozen_author_name: "Eleanor Voss",
  frozen_language: "en",
  fingerprint: "a".repeat(64),
  fingerprint_algorithm: "pbc-v1",
  presented_by: null,
  presented_at: "2026-08-01T12:34:56.789Z",
  presentation_reason: null,
  superseded_by_candidate_id: null,
  superseded_at: null,
  withdrawn_by: null,
  withdrawn_at: null,
  withdrawal_reason: null,
};

const consumed: ConsumedMetadata = {
  imprint: PUBLISHER_IMPRINT,
  legalEntity: PUBLISHER_LEGAL_ENTITY,
  description:
    "A quiet account of deterministic hours, told in the order the presses keep them.",
  copyrightYear: 2026,
  copyrightLine: null,
  publicationNotes: null,
  authorDisplay: "Eleanor Voss",
  contributors: [{ name: "Tomás Vega", role: "translator" }],
  isbn13: "9780306406157",
  isbnAsEntered: "978-0-306-40615-7",
};

/** 1×1 grayscale JPEG — a governed-asset stand-in with real SOF data. */
const TINY_JPEG =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

describe("hgp-cover serializer", () => {
  it("renders the deterministic typographic wrap with the ISBN block", async () => {
    const one = await generateCoverPdf(record, consumed, 200, null);
    const two = await generateCoverPdf(record, consumed, 200, null);
    expect(one.checksum).toBe(two.checksum);
    expect(COVER_SERIALIZER_VERSION).toBe("1.0.0");

    const structural = validatePdfStructure(one.bytes, 1);
    expect(structural.valid, JSON.stringify(structural.checks)).toBe(true);
    const production = validateCoverProduction(
      one.bytes,
      one.model,
      one.geometry,
      one.profile,
      { isbnConsumed: true, assetUsed: false },
    );
    expect(production.valid, JSON.stringify(production.checks)).toBe(true);

    const text = one.bytes.toString("latin1");
    expect(text).toContain("ISBN 978-0-306-40615-7");
    expect(text).toContain("ELEANOR VOSS");
    expect(text).toContain(PUBLISHER_IMPRINT);
    // Spine text present at 200 pages (threshold holds).
    expect(one.model.lines.some((l) => l.rotated)).toBe(true);
  });

  it("absence stays absent: no ISBN, no description, thin spine", async () => {
    const bare = await generateCoverPdf(
      record,
      { ...consumed, isbn13: null, isbnAsEntered: null, description: null },
      100,
      null,
    );
    const text = bare.bytes.toString("latin1");
    expect(text).not.toContain("ISBN ");
    expect(bare.model.rects.length).toBe(0);
    expect(bare.model.lines.some((l) => l.rotated)).toBe(false);
    const production = validateCoverProduction(
      bare.bytes,
      bare.model,
      bare.geometry,
      bare.profile,
      { isbnConsumed: false, assetUsed: false },
    );
    expect(production.valid, JSON.stringify(production.checks)).toBe(true);
  });

  it("embeds a governed asset as exact bytes, deterministically", async () => {
    const bytes = Buffer.from(TINY_JPEG, "base64");
    const asset = {
      id: "asset-1",
      assetKey: "test-front",
      bytes,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
    const one = await generateCoverPdf(record, consumed, 200, asset);
    const two = await generateCoverPdf(record, consumed, 200, asset);
    expect(one.checksum).toBe(two.checksum);
    expect(one.checksum).not.toBe(
      (await generateCoverPdf(record, consumed, 200, null)).checksum,
    );
    const text = one.bytes.toString("latin1");
    expect(text).toContain("/DCTDecode");
    expect(
      validateCoverProduction(one.bytes, one.model, one.geometry, one.profile, {
        isbnConsumed: true,
        assetUsed: true,
      }).valid,
    ).toBe(true);
    // A lying checksum fails closed.
    await expect(
      generateCoverPdf(record, consumed, 200, {
        ...asset,
        sha256: "0".repeat(64),
      }),
    ).rejects.toThrow(UnsupportedContentError);
  });

  it("different wrapped page counts produce different bytes (spine truth)", async () => {
    const a = await generateCoverPdf(record, consumed, 200, null);
    const b = await generateCoverPdf(record, consumed, 300, null);
    expect(a.checksum).not.toBe(b.checksum);
    expect(b.geometry.spineWidth).toBe(Math.round((300 * 72000) / 444));
  });
});
