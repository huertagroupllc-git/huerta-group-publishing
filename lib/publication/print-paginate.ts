import { createHash } from "node:crypto";
import type { LoadedFont } from "@/lib/publication/print-font-loader";
import type { ConsumedMetadata } from "@/lib/publication/metadata-fingerprint";
import type { PrintProfile } from "@/lib/publication/print-profile";
import {
  UnsupportedContentError,
  type PrintBlock,
  type PrintRepresentation,
  type Run,
  type RunStyle,
} from "@/lib/publication/print-representation";

/**
 * The deterministic pagination engine (renderer `hgp-layout` 1.0.0,
 * Print blueprint §11/§14). Pure integer arithmetic over font-unit
 * advance widths on a fixed leading grid — no OS text stack, no
 * floats in decisions, no environment anywhere. Same representation +
 * profile + fonts → same pages, always.
 *
 * Deterministic precedence when constraints conflict (frozen order):
 *   1. preserve content;  2. preserve page geometry;
 *   3. keep the chapter-title block together (structural: openings own
 *      their fixed grid);  4. keep headings with ≥2 body lines;
 *   5. widow/orphan minimum 2;  6. otherwise move content forward.
 */

export const RENDERER_ID = "hgp-layout";
export const RENDERER_VERSION = "1.0.0";
/** hgp-layout 2.0.0 — the metadata-consuming generation: the title
 *  page gains the imprint line and the title verso becomes the
 *  deterministic copyright page (Consumption blueprint §15–§16).
 *  Without a consumed metadata input the 1.0.0 layout is reproduced
 *  exactly, forever. */
export const RENDERER_VERSION_METADATA = "2.0.0";

export interface LineSegment {
  fontKey: string;
  sizeMpt: number; // millipoints
  text: string;
}

export interface PlacedLine {
  slot: number; // 0-based grid slot
  xMpt: number;
  segments: LineSegment[];
  align?: "center";
}

export type PageKind =
  | "title"
  | "copyright"
  | "blank"
  | "part-opening"
  | "chapter-opening"
  | "body";

export interface PrintPage {
  pageNumber: number; // 1-based, arabic throughout
  kind: PageKind;
  intentionalBlank: boolean;
  folioVisible: boolean;
  runningHead: { text: string } | null;
  chapterSeq: number | null;
  chapterTitle: string | null;
  lines: PlacedLine[];
}

export interface PageModel {
  pages: PrintPage[];
  pageCount: number;
  paginationFingerprint: string;
  fontsUsed: string[];
}

interface Word {
  style: RunStyle;
  text: string;
  widthUnits: number; // at unitsPerEm scale of its font
  spaceAfterUnits: number;
}

type Fonts = Record<"regular" | "italic" | "bold" | "display", LoadedFont>;

function fontFor(fonts: Fonts, style: RunStyle): LoadedFont {
  return style === "italic"
    ? fonts.italic
    : style === "bold"
      ? fonts.bold
      : fonts.regular;
}

function measureUnits(font: LoadedFont, text: string): number {
  let units = 0;
  for (const ch of text) {
    const w = font.advance(ch.codePointAt(0)!);
    if (w === null) throw new Error(`missing_glyph:${ch}`);
    units += w;
  }
  return units;
}

/** Width in millipoints of `units` font units at `sizeMpt`. Integer. */
function unitsToMpt(units: number, unitsPerEm: number, sizeMpt: number): number {
  return Math.round((units * sizeMpt) / unitsPerEm);
}

function wordsOf(runs: Run[], fonts: Fonts): Word[] {
  const words: Word[] = [];
  for (const run of runs) {
    const font = fontFor(fonts, run.style);
    const parts = run.text.split(" ");
    parts.forEach((part, i) => {
      if (part === "") return;
      words.push({
        style: run.style,
        text: part,
        widthUnits: measureUnits(font, part),
        spaceAfterUnits:
          i < parts.length - 1 ? measureUnits(font, " ") : 0,
      });
    });
    // A run ending in a space joins to the next run's word.
    if (run.text.endsWith(" ") && words.length) {
      words[words.length - 1].spaceAfterUnits = measureUnits(font, " ");
    }
  }
  return words;
}

/** Greedy ragged-right line breaking on the fixed measure. */
function breakLines(
  words: Word[],
  fonts: Fonts,
  sizeMpt: number,
  measureMpt: number,
  firstIndentMpt: number,
): { segments: LineSegment[]; indentMpt: number }[] {
  const lines: { segments: LineSegment[]; indentMpt: number }[] = [];
  let current: Word[] = [];
  let currentMpt = 0;
  let available = measureMpt - firstIndentMpt;

  const flush = () => {
    if (!current.length) return;
    const segments: LineSegment[] = [];
    for (const w of current) {
      const font = fontFor(fonts, w.style);
      const text =
        w === current[current.length - 1] || w.spaceAfterUnits === 0
          ? w.text
          : `${w.text} `;
      const last = segments[segments.length - 1];
      if (last && last.fontKey === font.fontKey) last.text += text;
      else segments.push({ fontKey: font.fontKey, sizeMpt, text });
    }
    lines.push({
      segments,
      indentMpt: lines.length === 0 ? firstIndentMpt : 0,
    });
    current = [];
    currentMpt = 0;
    available = measureMpt;
  };

  for (const word of words) {
    const font = fontFor(fonts, word.style);
    const wMpt = unitsToMpt(word.widthUnits, font.unitsPerEm, sizeMpt);
    const sMpt = unitsToMpt(word.spaceAfterUnits, font.unitsPerEm, sizeMpt);
    if (current.length && currentMpt + wMpt > available) flush();
    current.push(word);
    currentMpt += wMpt + sMpt;
  }
  flush();
  return lines;
}

interface FlowLine {
  segments: LineSegment[];
  indentMpt: number;
  /** Paragraph grouping facts for widow/orphan decisions. */
  paraId: number;
  paraLineIndex: number;
  paraLineCount: number;
  isHeading: boolean;
  blank?: boolean;
}

/** Flatten a chapter's blocks into flow lines on the body grid. */
function chapterFlow(
  blocks: PrintBlock[],
  fonts: Fonts,
  profile: PrintProfile,
): FlowLine[] {
  const measure =
    profile.pageWidth - profile.marginInside - profile.marginOutside;
  const flow: FlowLine[] = [];
  let paraId = 0;
  let suppressIndent = true; // first paragraph of the chapter

  for (const block of blocks) {
    if (block.kind === "sectionBreak") {
      flow.push({
        segments: [],
        indentMpt: 0,
        paraId: ++paraId,
        paraLineIndex: 0,
        paraLineCount: 1,
        isHeading: false,
        blank: true,
      });
      suppressIndent = true;
      continue;
    }
    if (block.kind === "heading") {
      const style: RunStyle = block.level === 2 ? "bold" : "italic";
      const runs = block.runs.map((r) => ({ ...r, style }));
      const lines = breakLines(
        wordsOf(runs, fonts),
        fonts,
        profile.bodySize,
        measure,
        0,
      );
      paraId += 1;
      // Blank slot above a heading (never at a page top — pagination
      // trims leading blanks).
      flow.push({
        segments: [],
        indentMpt: 0,
        paraId,
        paraLineIndex: 0,
        paraLineCount: 1,
        isHeading: false,
        blank: true,
      });
      lines.forEach((line, i) => {
        flow.push({
          segments: line.segments,
          indentMpt: 0,
          paraId,
          paraLineIndex: i,
          paraLineCount: lines.length,
          isHeading: true,
        });
      });
      suppressIndent = true;
      continue;
    }
    // paragraph
    const indent = suppressIndent ? 0 : profile.firstLineIndent;
    const lines = breakLines(
      wordsOf(block.runs, fonts),
      fonts,
      profile.bodySize,
      measure,
      indent,
    );
    paraId += 1;
    lines.forEach((line, i) => {
      flow.push({
        segments: line.segments,
        indentMpt: line.indentMpt,
        paraId,
        paraLineIndex: i,
        paraLineCount: lines.length,
        isHeading: false,
      });
    });
    suppressIndent = false;
  }
  return flow;
}

export function paginate(
  rep: PrintRepresentation,
  profile: PrintProfile,
  fonts: Fonts,
  consumed?: ConsumedMetadata,
): PageModel {
  const pages: PrintPage[] = [];
  const contentLeft = (pageNumber: number) =>
    pageNumber % 2 === 1 ? profile.marginInside : profile.marginOutside;

  const push = (page: Omit<PrintPage, "pageNumber">): PrintPage => {
    const created = { ...page, pageNumber: pages.length + 1 };
    pages.push(created);
    return created;
  };

  const blankPage = () =>
    push({
      kind: "blank",
      intentionalBlank: true,
      folioVisible: false,
      runningHead: null,
      chapterSeq: null,
      chapterTitle: null,
      lines: [],
    });

  const ensureNextRecto = () => {
    if ((pages.length + 1) % 2 === 0) blankPage();
  };

  // --- Title page (page 1, recto) ---
  {
    const lines: PlacedLine[] = [
      {
        slot: 12,
        xMpt: 0,
        align: "center",
        segments: [
          {
            fontKey: profile.displayFont,
            sizeMpt: profile.chapterTitleSize,
            text: rep.title,
          },
        ],
      },
    ];
    if (rep.subtitle) {
      lines.push({
        slot: 15,
        xMpt: 0,
        align: "center",
        segments: [
          {
            fontKey: profile.italicFont,
            sizeMpt: profile.bodySize,
            text: rep.subtitle,
          },
        ],
      });
    }
    lines.push({
      slot: 20,
      xMpt: 0,
      align: "center",
      segments: [
        {
          fontKey: profile.displayFont,
          sizeMpt: profile.bodySize,
          text: rep.authorName.toUpperCase(),
        },
      ],
    });
    if (consumed) {
      lines.push({
        slot: 34,
        xMpt: 0,
        align: "center",
        segments: [
          {
            fontKey: profile.bodyFont,
            sizeMpt: profile.bodySize,
            text: consumed.imprint,
          },
        ],
      });
    }
    push({
      kind: "title",
      intentionalBlank: false,
      folioVisible: false,
      runningHead: null,
      chapterSeq: null,
      chapterTitle: null,
      lines,
    });
  }

  // --- Copyright page (page 2, the title verso) — hgp-layout 2.0.0
  // (Consumption blueprint §16): governed facts only, fixed order,
  // absent facts produce absent lines, nothing fabricated. Occupies
  // the slot the 1.0.0 layout leaves structurally blank, so body
  // pagination and page count are unchanged.
  if (consumed) {
    const es = rep.language.toLowerCase().startsWith("es");
    const measure =
      profile.pageWidth - profile.marginInside - profile.marginOutside;
    const entries: { runs: Run[]; gapBefore: boolean }[] = [];
    const entry = (text: string, style: RunStyle, gapBefore: boolean) =>
      entries.push({ runs: [{ style, text }], gapBefore });

    entry(rep.title, "regular", false);
    if (rep.subtitle) entry(rep.subtitle, "italic", false);
    const copyrightLine =
      consumed.copyrightLine ??
      (consumed.copyrightYear !== null
        ? `© ${consumed.copyrightYear} ${consumed.authorDisplay}`
        : null);
    if (copyrightLine) entry(copyrightLine, "regular", true);
    entry(
      es
        ? `Publicado por ${consumed.imprint}`
        : `Published by ${consumed.imprint}`,
      "regular",
      true,
    );
    entry(
      es
        ? `Un sello de ${consumed.legalEntity}`
        : `An imprint of ${consumed.legalEntity}`,
      "regular",
      false,
    );
    if (consumed.isbnAsEntered) {
      entry(`ISBN ${consumed.isbnAsEntered}`, "regular", true);
    }
    if (consumed.publicationNotes) {
      entry(consumed.publicationNotes, "regular", true);
    }

    const lines: PlacedLine[] = [];
    let slot = 22;
    for (const e of entries) {
      if (e.gapBefore && lines.length) slot += 1;
      const broken = breakLines(
        wordsOf(e.runs, fonts),
        fonts,
        profile.bodySize,
        measure,
        0,
      );
      for (const line of broken) {
        lines.push({ slot, xMpt: 0, segments: line.segments });
        slot += 1;
      }
    }
    if (slot > profile.linesPerPage) {
      throw new UnsupportedContentError(
        "unsupported_content",
        "copyright_page_overflow",
      );
    }
    push({
      kind: "copyright",
      intentionalBlank: false,
      folioVisible: false,
      runningHead: null,
      chapterSeq: null,
      chapterTitle: null,
      lines,
    });
  }

  for (const section of rep.sections) {
    if (section.partTitle !== null) {
      ensureNextRecto();
      push({
        kind: "part-opening",
        intentionalBlank: false,
        folioVisible: false,
        runningHead: null,
        chapterSeq: null,
        chapterTitle: null,
        lines: [
          {
            slot: profile.partTitleLine,
            xMpt: 0,
            align: "center",
            segments: [
              {
                fontKey: profile.displayFont,
                sizeMpt: profile.chapterTitleSize,
                text: section.partTitle,
              },
            ],
          },
        ],
      });
    }

    for (const chapter of section.chapters) {
      if (profile.chapterOpensRecto) ensureNextRecto();

      // Chapter opening page: fixed grid (title block structurally
      // together — precedence rule 3).
      const eyebrow =
        chapter.kind === "appendix"
          ? rep.language.toLowerCase().startsWith("es")
            ? "APÉNDICE"
            : "APPENDIX"
          : rep.language.toLowerCase().startsWith("es")
            ? `CAPÍTULO ${chapter.chapterNumber}`
            : `CHAPTER ${chapter.chapterNumber}`;

      const measure =
        profile.pageWidth - profile.marginInside - profile.marginOutside;
      const titleLines = breakLines(
        wordsOf([{ style: "regular", text: chapter.title }], {
          ...fonts,
          regular: fonts.display,
        }),
        { ...fonts, regular: fonts.display },
        profile.chapterTitleSize,
        measure,
        0,
      );

      const openingLines: PlacedLine[] = [
        {
          slot: profile.eyebrowLine,
          xMpt: 0,
          align: "center",
          segments: [
            {
              fontKey: profile.displayFont,
              sizeMpt: profile.bodySize,
              text: eyebrow,
            },
          ],
        },
        ...titleLines.map((line, i) => ({
          slot: profile.chapterTitleLine + i * 2,
          xMpt: 0,
          align: "center" as const,
          segments: line.segments,
        })),
      ];

      const bodyStart =
        profile.chapterBodyStartLine + (titleLines.length - 1) * 2;

      const opening = push({
        kind: "chapter-opening",
        intentionalBlank: false,
        folioVisible: false,
        runningHead: null,
        chapterSeq: chapter.seq,
        chapterTitle: chapter.title,
        lines: openingLines,
      });

      // Flow the chapter body across the opening page + body pages.
      const flow = chapterFlow(chapter.blocks, fonts, profile);
      let slot = bodyStart;
      let page = opening;
      let capacity = profile.linesPerPage;

      const newBodyPage = () => {
        const pageNumber = pages.length + 1;
        page = push({
          kind: "body",
          intentionalBlank: false,
          folioVisible: true,
          runningHead: {
            text: pageNumber % 2 === 0 ? rep.title : chapter.title,
          },
          chapterSeq: chapter.seq,
          chapterTitle: chapter.title,
          lines: [],
        });
        slot = 0;
      };

      let i = 0;
      while (i < flow.length) {
        const line = flow[i];
        if (slot >= capacity) newBodyPage();

        if (line.blank) {
          // Never spend a blank at a page top.
          if (slot > 0) slot += 1;
          i += 1;
          continue;
        }

        const slotsLeft = capacity - slot;

        // Precedence 4: a heading keeps ≥ headingKeepLines body lines.
        if (line.isHeading && line.paraLineIndex === 0) {
          const headingLines = line.paraLineCount;
          if (slotsLeft < headingLines + profile.headingKeepLines) {
            newBodyPage();
            continue;
          }
        }

        // Precedence 5: orphan/widow minima for paragraph starts.
        if (!line.isHeading && line.paraLineIndex === 0) {
          const remainingPara = line.paraLineCount;
          if (remainingPara > slotsLeft) {
            // Splitting: leave ≥ orphanMinimum here and ≥ widowMinimum
            // for the next page, else push the whole paragraph.
            const carried = remainingPara - slotsLeft;
            if (
              slotsLeft < profile.orphanMinimum ||
              (carried < profile.widowMinimum &&
                slotsLeft - (profile.widowMinimum - carried) <
                  profile.orphanMinimum)
            ) {
              newBodyPage();
              continue;
            }
            if (carried < profile.widowMinimum) {
              // Break earlier so the widow minimum holds.
              capacity = slot + (slotsLeft - (profile.widowMinimum - carried));
            }
          }
        }

        page.lines.push({
          slot,
          xMpt: contentLeft(page.pageNumber) + line.indentMpt,
          segments: line.segments,
        });
        slot += 1;
        i += 1;
        if (capacity !== profile.linesPerPage && slot >= capacity) {
          newBodyPage();
          capacity = profile.linesPerPage;
        }
      }
      // Restore capacity for the next chapter.
      capacity = profile.linesPerPage;
    }
  }

  const fontsUsed = [
    profile.bodyFont,
    profile.italicFont,
    profile.boldFont,
    profile.displayFont,
  ];

  const canonical = pages
    .map((p) =>
      [
        p.pageNumber,
        p.kind,
        p.intentionalBlank ? 1 : 0,
        p.folioVisible ? 1 : 0,
        p.runningHead?.text ?? "",
        p.chapterSeq ?? "",
        p.lines
          .map(
            (l) =>
              `${l.slot}|${l.xMpt}|${l.align ?? ""}|` +
              l.segments
                .map((s) => `${s.fontKey}@${s.sizeMpt}:${s.text}`)
                .join(""),
          )
          .join(""),
      ].join(""),
    )
    .join("");

  return {
    pages,
    pageCount: pages.length,
    paginationFingerprint: createHash("sha256")
      .update(canonical, "utf8")
      .digest("hex"),
    fontsUsed,
  };
}
