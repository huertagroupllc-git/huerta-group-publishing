import { createHash } from "node:crypto";
import { buildDeterministicZip, type ZipEntryInput } from "@/lib/publication/zip";
import type { ConsumedMetadata } from "@/lib/publication/metadata-fingerprint";
import type {
  PublicationRepresentation,
  RepresentationChapter,
} from "@/lib/publication/serializer";

/**
 * Deterministic EPUB 3 generation (Phase 3 WP-35/36/37). Standard:
 * EPUB 3.3 (package version attribute "3.0", per the specification).
 * Every byte derives from the frozen PublicationRepresentation: stable
 * file names and identifiers from canonical sequence, dcterms:modified
 * from the candidate's presentation moment, fixed ZIP metadata. Same
 * representation in, same bytes and SHA-256 out — always.
 *
 * The text is preserved faithfully: no prose rewriting, no typographic
 * "improvement", no AI. Escaping is the minimum XML safety on facts we
 * interpolate (titles, names); chapter bodies arrive as already
 * well-formed XHTML from the deterministic Markdown pipeline.
 */

const XML_DECL = `<?xml version="1.0" encoding="utf-8"?>\n`;

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function chapterFile(c: RepresentationChapter): string {
  return `chapter-${String(c.seq).padStart(3, "0")}.xhtml`;
}

function chapterId(c: RepresentationChapter): string {
  return `chapter-${String(c.seq).padStart(3, "0")}`;
}

/** Chapter eyebrow labels by primary language subtag; the frozen
 *  manuscript language governs, defaulting to English. */
function labels(language: string): { chapter: string; appendix: string } {
  return language.toLowerCase().startsWith("es")
    ? { chapter: "Capítulo", appendix: "Apéndice" }
    : { chapter: "Chapter", appendix: "Appendix" };
}

const STYLESHEET = `/* Huerta Group Publishing — restrained, reflowable, semantic. */
body { margin: 0 5%; font-family: serif; line-height: 1.5; }
h1, h2 { font-weight: normal; text-align: center; }
h1 { font-size: 1.6em; margin: 2.5em 0 1.5em; }
h2 { font-size: 1.3em; margin: 2em 0 1em; }
p { margin: 0 0 0 0; text-indent: 1.25em; }
p:first-of-type, h1 + p, h2 + p, hr + p { text-indent: 0; }
.titlepage { text-align: center; margin-top: 30%; }
.titlepage .title { font-size: 2em; margin-bottom: 0.5em; }
.titlepage .subtitle { font-style: italic; margin-bottom: 3em; }
.titlepage .author { letter-spacing: 0.12em; text-transform: uppercase; }
.eyebrow { text-align: center; letter-spacing: 0.12em;
  text-transform: uppercase; font-size: 0.8em; margin-bottom: 0; }
.part { text-align: center; margin-top: 40%; }
blockquote { margin: 1em 2em; font-style: italic; }
hr { border: none; text-align: center; margin: 1.5em 0; }
hr::after { content: "· · ·"; letter-spacing: 0.5em; }
`;

function xhtmlDoc(language: string, title: string, body: string): string {
  return (
    XML_DECL +
    `<!DOCTYPE html>\n` +
    `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${esc(language)}" lang="${esc(language)}">\n` +
    `<head>\n<title>${esc(title)}</title>\n` +
    `<link rel="stylesheet" type="text/css" href="style.css"/>\n` +
    `</head>\n<body>\n${body}</body>\n</html>\n`
  );
}

export interface GeneratedEpub {
  bytes: Buffer;
  checksum: string; // sha256 hex
  byteSize: number;
  fileNames: string[];
}

/** MARC relator terms for the ten governed contributor roles — every
 *  role maps cleanly (the vocabulary was chosen mappable), so no role
 *  ships as a stretched code. */
const MARC_RELATORS: Record<string, string> = {
  author: "aut",
  "co-author": "aut",
  editor: "edt",
  translator: "trl",
  illustrator: "ill",
  photographer: "pht",
  foreword: "aui",
  introduction: "aui",
  afterword: "aft",
  contributor: "ctb",
};

/**
 * Package-metadata additions of hgp-epub 2.0.0 (Consumption blueprint
 * §13–§14): the unique identifier remains the institutional urn:uuid
 * in every case; a consumed ISBN is an additional identifier; the
 * consumed version supplies only what the candidate cannot know.
 * When `consumed` is absent, generation is exactly hgp-epub 1.0.0.
 */
function metadataElements(consumed: ConsumedMetadata): string {
  let out = "";
  if (consumed.isbn13) {
    out += `<dc:identifier>urn:isbn:${esc(consumed.isbn13)}</dc:identifier>\n`;
  }
  consumed.contributors.forEach((c, i) => {
    const id = `contrib-${i + 1}`;
    out +=
      `<dc:contributor id="${id}">${esc(c.name)}</dc:contributor>\n` +
      `<meta refines="#${id}" property="role" scheme="marc:relators">${MARC_RELATORS[c.role] ?? "ctb"}</meta>\n`;
  });
  out += `<dc:publisher>${esc(consumed.imprint)}</dc:publisher>\n`;
  if (consumed.description) {
    out += `<dc:description>${esc(consumed.description)}</dc:description>\n`;
  }
  return out;
}

export function generateEpub(
  rep: PublicationRepresentation,
  consumed?: ConsumedMetadata,
): GeneratedEpub {
  const lbl = labels(rep.language);

  const contentFiles: { name: string; id: string; content: string }[] = [];

  const titleBody =
    `<section class="titlepage" epub:type="titlepage">\n` +
    `<h1 class="title">${esc(rep.title)}</h1>\n` +
    (rep.subtitle ? `<p class="subtitle">${esc(rep.subtitle)}</p>\n` : "") +
    `<p class="author">${esc(rep.authorName)}</p>\n` +
    `</section>\n`;
  contentFiles.push({
    name: "titlepage.xhtml",
    id: "titlepage",
    content: xhtmlDoc(rep.language, rep.title, titleBody),
  });

  for (const section of rep.sections) {
    if (section.partTitle !== null) {
      contentFiles.push({
        name: `part-${section.partOrdinal}.xhtml`,
        id: `part-${section.partOrdinal}`,
        content: xhtmlDoc(
          rep.language,
          section.partTitle,
          `<section class="part" epub:type="part">\n<h1>${esc(section.partTitle)}</h1>\n</section>\n`,
        ),
      });
    }
    for (const chapter of section.chapters) {
      const eyebrow =
        chapter.kind === "appendix"
          ? lbl.appendix
          : `${lbl.chapter} ${chapter.chapterNumber}`;
      const body =
        `<section epub:type="${chapter.kind === "appendix" ? "appendix" : "chapter"}">\n` +
        `<p class="eyebrow">${esc(eyebrow)}</p>\n` +
        `<h1>${esc(chapter.title)}</h1>\n` +
        chapter.xhtmlBody +
        `\n</section>\n`;
      contentFiles.push({
        name: chapterFile(chapter),
        id: chapterId(chapter),
        content: xhtmlDoc(rep.language, chapter.title, body),
      });
    }
  }

  // Navigation document — canonical reading order, parts nested.
  let navList = "";
  for (const section of rep.sections) {
    if (section.partTitle !== null) {
      navList +=
        `<li><a href="part-${section.partOrdinal}.xhtml">${esc(section.partTitle)}</a>\n<ol>\n` +
        section.chapters
          .map(
            (c) => `<li><a href="${chapterFile(c)}">${esc(c.title)}</a></li>\n`,
          )
          .join("") +
        `</ol>\n</li>\n`;
    } else {
      navList += section.chapters
        .map(
          (c) => `<li><a href="${chapterFile(c)}">${esc(c.title)}</a></li>\n`,
        )
        .join("");
    }
  }
  const nav = xhtmlDoc(
    rep.language,
    rep.title,
    `<nav epub:type="toc" id="toc">\n<ol>\n<li><a href="titlepage.xhtml">${esc(rep.title)}</a></li>\n${navList}</ol>\n</nav>\n`,
  );

  const manifestItems = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="style" href="style.css" media-type="text/css"/>`,
    ...contentFiles.map(
      (f) =>
        `<item id="${f.id}" href="${f.name}" media-type="application/xhtml+xml"/>`,
    ),
  ];
  const spineItems = contentFiles.map((f) => `<itemref idref="${f.id}"/>`);

  const packageDoc =
    XML_DECL +
    `<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${esc(rep.language)}">\n` +
    `<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n` +
    `<dc:identifier id="pub-id">urn:uuid:${esc(rep.candidateId)}</dc:identifier>\n` +
    `<dc:title>${esc(rep.title)}</dc:title>\n` +
    `<dc:creator>${esc(rep.authorName)}</dc:creator>\n` +
    `<dc:language>${esc(rep.language)}</dc:language>\n` +
    (consumed ? metadataElements(consumed) : "") +
    `<meta property="dcterms:modified">${esc(rep.modified)}</meta>\n` +
    `</metadata>\n` +
    `<manifest>\n${manifestItems.join("\n")}\n</manifest>\n` +
    `<spine>\n${spineItems.join("\n")}\n</spine>\n` +
    `</package>\n`;

  const container =
    XML_DECL +
    `<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">\n` +
    `<rootfiles>\n<rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/>\n</rootfiles>\n` +
    `</container>\n`;

  const entries: ZipEntryInput[] = [
    { name: "mimetype", data: Buffer.from("application/epub+zip", "ascii") },
    { name: "META-INF/container.xml", data: Buffer.from(container, "utf8") },
    { name: "OEBPS/package.opf", data: Buffer.from(packageDoc, "utf8") },
    { name: "OEBPS/nav.xhtml", data: Buffer.from(nav, "utf8") },
    { name: "OEBPS/style.css", data: Buffer.from(STYLESHEET, "utf8") },
    ...contentFiles.map((f) => ({
      name: `OEBPS/${f.name}`,
      data: Buffer.from(f.content, "utf8"),
    })),
  ];

  const bytes = buildDeterministicZip(entries);
  return {
    bytes,
    checksum: createHash("sha256").update(bytes).digest("hex"),
    byteSize: bytes.length,
    fileNames: entries.map((e) => e.name),
  };
}
