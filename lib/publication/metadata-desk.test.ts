import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BIBLIOGRAPHIC_VERSIONS_OF_RECORD,
  buildMetadataDesk,
  type MetadataRecordRow,
} from "@/lib/publication/metadata-desk";
import type { DerivedBookFacts } from "@/lib/publication/metadata-derive";

/**
 * Regression: the Bibliographic Record initiation defect (August 2026).
 * A governed Version 1 draft stood in production while the Metadata
 * page rendered "No bibliographic record exists yet" and offered
 * "Begin the bibliographic record" again — because the versions embed
 * from `bibliographic_records` was ambiguous (two foreign keys relate
 * the tables) and PostgREST refused it (PGRST201), which the read
 * treated as an empty record. The embed is now pinned by FK name and
 * the read model is pure and pinned here.
 */

const live: DerivedBookFacts = {
  title: "The Conversational Mind",
  subtitle: "Understanding How Conversation Shapes Thought",
  authorDisplay: "E.N. Huerta",
  language: "en",
};

const version = (
  overrides: Partial<NonNullable<MetadataRecordRow["bibliographic_versions"]>[number]> = {},
) => ({
  id: "v1",
  version_number: 1,
  status: "draft" as const,
  derived_title: live.title,
  derived_subtitle: live.subtitle,
  derived_author_display: live.authorDisplay,
  derived_language: live.language,
  publication_description: null,
  short_description: null,
  marketing_description: null,
  keywords: [],
  categories: [],
  copyright_year: null,
  copyright_line: null,
  publication_notes: null,
  change_summary: null,
  created_at: "2026-08-17T00:45:24.901Z",
  finalized_at: null,
  bibliographic_contributors: null,
  ...overrides,
});

describe("the versions-of-record embed is unambiguous", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260814000000_publication_metadata.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("pins the one-to-many relationship by its foreign-key name", () => {
    expect(BIBLIOGRAPHIC_VERSIONS_OF_RECORD).toBe(
      "bibliographic_versions!bibliographic_versions_record_id_fkey",
    );
  });

  it("names a foreign key the schema actually declares (record_id → records, default constraint name)", () => {
    // `record_id uuid not null references public.bibliographic_records (id)`
    // inside `create table public.bibliographic_versions` yields the
    // default constraint name bibliographic_versions_record_id_fkey.
    const versionsTable = migration.slice(
      migration.indexOf("create table public.bibliographic_versions ("),
    );
    expect(versionsTable).toMatch(
      /record_id\s+uuid not null references public\.bibliographic_records \(id\)/,
    );
    expect(versionsTable).not.toMatch(/constraint\s+\S+\s+foreign key \(record_id\)/i);
  });

  it("is needed because a second relationship exists: the active-version pointer", () => {
    expect(migration).toMatch(
      /add constraint fk_bibliographic_active_version\s+foreign key \(active_version_id, id\)\s+references public\.bibliographic_versions \(id, record_id\)/,
    );
  });
});

describe("buildMetadataDesk — the read model over what the database returns", () => {
  it("reports no record when no family exists (the honest empty state)", () => {
    const desk = buildMetadataDesk(live, null, []);
    expect(desk.versions).toEqual([]);
    expect(desk.draft).toBeNull();
    expect(desk.active).toBeNull();
    expect(desk.divergence).toEqual([]);
    expect(desk.isbns).toEqual([]);
  });

  it("shows the real Version 1 draft with its derived facts once Begin has run", () => {
    const desk = buildMetadataDesk(
      live,
      { active_version_id: null, bibliographic_versions: [version()] },
      [],
    );
    expect(desk.draft).not.toBeNull();
    expect(desk.draft?.version_number).toBe(1);
    expect(desk.draft?.status).toBe("draft");
    expect(desk.draft?.derived_title).toBe("The Conversational Mind");
    expect(desk.draft?.derived_subtitle).toBe("Understanding How Conversation Shapes Thought");
    expect(desk.draft?.derived_author_display).toBe("E.N. Huerta");
    expect(desk.draft?.derived_language).toBe("en");
    expect(desk.draft?.contributors).toEqual([]);
    // Nothing is finalized or active by drafting alone.
    expect(desk.active).toBeNull();
    expect(desk.versions.filter((v) => v.status === "final")).toEqual([]);
  });

  it("orders versions newest first, contributors by position, and resolves the active pointer", () => {
    const desk = buildMetadataDesk(
      live,
      {
        active_version_id: "v1",
        bibliographic_versions: [
          version({
            id: "v1",
            status: "final",
            finalized_at: "2026-08-17T01:00:00Z",
            bibliographic_contributors: [
              { id: "c2", position: 2, display_name: "A. Editor", role: "editor", derived: false, note: null },
              { id: "c1", position: 1, display_name: "E.N. Huerta", role: "author", derived: true, note: null },
            ],
          }),
          version({ id: "v2", version_number: 2 }),
        ],
      },
      [],
    );
    expect(desk.versions.map((v) => v.version_number)).toEqual([2, 1]);
    expect(desk.draft?.id).toBe("v2");
    expect(desk.active?.id).toBe("v1");
    expect(desk.active?.contributors.map((c) => c.position)).toEqual([1, 2]);
    expect(desk.divergence).toEqual([]);
  });

  it("computes divergence only against the active version, never the draft", () => {
    const desk = buildMetadataDesk(
      { ...live, title: "A New Title" },
      {
        active_version_id: "v1",
        bibliographic_versions: [
          version({ id: "v1", status: "final", finalized_at: "2026-08-17T01:00:00Z" }),
        ],
      },
      [],
    );
    expect(desk.divergence).toEqual(["titleChanged"]);
    const draftOnly = buildMetadataDesk(
      { ...live, title: "A New Title" },
      { active_version_id: null, bibliographic_versions: [version()] },
      [],
    );
    expect(draftOnly.divergence).toEqual([]);
  });

  it("counts ISBN evidence per registration", () => {
    const desk = buildMetadataDesk(live, null, [
      {
        id: "r1",
        isbn13: "9780306406157",
        isbn_as_entered: "978-0-306-40615-7",
        source: "agency",
        disposition: "recorded",
        externally_assigned: true,
        external_title: null,
        external_format_wording: null,
        external_registrant: null,
        recorded_at: "2026-08-17T00:00:00Z",
        isbn_evidence: [{ id: "e1" }, { id: "e2" }],
      },
    ]);
    expect(desk.isbns[0].evidence_count).toBe(2);
  });
});
