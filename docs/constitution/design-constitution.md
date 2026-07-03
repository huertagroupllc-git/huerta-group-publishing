# Design Constitution — v1

Huerta Group Publishing · Author Operating System
Status: proposed, awaiting approval. Every future screen follows this
document; deviations require amending it first.

---

## 1. The editorial desk

The workspace is an editorial desk; the public site is an imprint's front
matter. Both are typeset like book pages: a masthead, hairline rules,
generous margins, a reading column, metadata in the margins. Neither ever
resembles a CRM, an analytics panel, or an admin template.

## 2. Typography carries meaning

Three faces, three jobs, never traded:

- **Fraunces** — display: page titles, author names, document titles.
- **Newsreader** — text: all prose, document content, form input text.
- **Inter** — utility only: eyebrow labels (letterspaced small caps),
  metadata, timestamps, error lines. Never for prose.

Prose sits at a book measure (~65–75 characters), 1.6–1.75 leading.
Hierarchy is expressed by size, weight, and position — not by color,
boxes, or icons. If a screen needs a fourth face or a fifth heading level,
the screen is wrong.

## 3. The palette is fixed and small

Tokens (already in `globals.css`) are the entire palette:

- `paper` / `parchment` — surfaces
- `ink` / `ink-soft` / `ink-faint` — text
- `oxblood` / `oxblood-deep` — the single accent
- `rule` — hairlines

**Oxblood means "the act that matters":** the active version marker, the
one primary action per view, error notes, and hover intent. It is never
decorative. If oxblood appears more than a few times on a screen, the
screen has too many priorities.

## 4. Structure: rules and whitespace, not cards

Hairline rules and whitespace are the only separators. No cards, boxes,
shadows, gradients, rounded panels, or background tints to group content.
Lists are ruled lists. Two-zone layouts (reading pane + narrow margin
rail) are the standard for any object with history or metadata.

## 5. Words first; glyphs as ornament only

Actions are named in words ("New version", "Restore as the active
version"). No hamburgers, gears, pencils, trash cans, icon buttons, or
icon-only actions — where an *action* needs signaling, use a word
("Show", "Hide", "Edit").

Hairline **editorial glyphs** are permitted as secondary ornament beside
typography (amended July 2026): thin monochrome line drawings, stroke
~1.25, set in faint ink, always accompanied by the words that carry the
meaning. Never colorful icon sets, filled icons, SaaS illustration
styles, or emoji. If removing a glyph would remove meaning, the glyph is
doing a word's job and must be replaced by one.

## 6. One primary act per view

Each screen has at most one oxblood (filled) action. Secondary acts are
hairline-bordered buttons; tertiary acts are small sans links. Destructive
or history-changing acts are visually quiet but verbally explicit —
danger is communicated by wording, not by red alarm styling.

## 7. Forms are typeset documents

Single column, eyebrow labels, hairline underlined fields, serif input
text at reading size. Multi-line content is edited in plain Markdown and
always rendered back as typeset prose (`.doc-prose`). No rich-text
toolbars, floating labels, or input adornments.

## 8. Metadata lives in the margins

Version numbers, dates, sources, and status are set small in Inter,
adjacent to — never inside — the prose. Dates are written like a line of
front matter: "July 3, 2026" — never numeric ("07/03/26"), never
abbreviated, never relative ("2 days ago" decays; the record does not).

**Record metadata is a colophon, not a sentence.** A record's standing
facts (Status, Begun, Working Title, Inherited From) are presented as
stacked entries — a small-caps label over a serif value — like the front
matter of a manuscript folder. Conversational metadata sentences
("Developing · begun 3 July 2026 under…") are forbidden: sentences are
for prose that teaches; labels are for facts that stand.

## 9. Stillness

No animation beyond instant state change. No skeleton shimmer, spinners
where avoidable, parallax, or transitions that draw attention to the
interface. The page appears set, like print.

## 10. Empty states and errors are typeset too

An empty state is a short serif paragraph teaching what belongs there,
plus the single next act. An error is one quiet oxblood sans line in
place, in plain language, saying what to do next. Neither uses boxes,
banners, toasts, or exclamation marks.

**The platform is always complete in the present.** If a sentence exists
only because the software is unfinished, it does not belong in the
product. No roadmap language, no "coming soon", no references to slices,
capabilities, or releases. An unbuilt surface communicates through its
empty state's timeless language ("Not yet established") or through
silence — never through a promise.

## 11. Floors, not aspirations

- Small sans text (`ink-faint`) is never used below 11px and never for
  load-bearing information — `ink-faint` is for ambience, `ink-soft` for
  information.
- Every interactive element has a visible focus state (oxblood underline
  or border).
- Headings are semantic (one h1 per page, ordered levels).
- Touch targets on mobile ≥ 40px; the margin rail stacks below the
  reading pane, never collapses into a hamburger.

## 12. The test

Before any screen ships, ask: *would this page look at home printed in the
front matter of a well-made book?* If not, it does not ship.
