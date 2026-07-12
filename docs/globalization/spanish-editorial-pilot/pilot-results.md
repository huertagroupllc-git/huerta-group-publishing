# Spanish Editorial Pilot — Results & Scorecard

Executed July 2026 against production. The gold standard
(pilot-design.md, commit 82a61e3) was committed BEFORE either review ran
and was not modified afterward. AI-side grading below is provisional;
the launch verdict requires a fluent Spanish reader's sign-off
(pilot-design.md, "Human review").

## The runs

| | Review A (baseline) | Review B (post-revision) |
| --- | --- | --- |
| Run ID | `10b299bb-0e53-4ae1-a479-b7a1b2ce8f99` | `64af2590-a0dc-4bc4-8c55-6338d2b7ad2a` |
| Estado | Completa · 4/4 lecturas | Completa · 4/4 lecturas |
| Modelo | gpt-4o | gpt-4o |
| Idioma de respuesta (frozen) | Español | Español |
| Huella del prompt | `e54b3f7f0e1a` | `e54b3f7f0e1a` |
| Hallazgos | 6 | 9 |

Between A and B: one deliberation adopted (the C2 manuscript finding —
partial adoption, reasoning names the misattributed example), one Nota
set aside (the borderline A1 observation), Chapter 2 revised to
Versión 2 (S2 guarantee removed; S3 return added at the close), the S2
finding resolved against Versión 2.

## Seed-by-seed grading (fixed matrix, pilot-design.md)

| Seed | Review A | Review B |
| --- | --- | --- |
| S1 universal law (Concern/C6) | **Found** — Inquietud, cites the clause's own words | **Found** again (correct; unfixed) — but contradicted by a Ch1 Nota in the same run that praises the tone *quoting the offending sentence as its excerpt* |
| S2 financial guarantee (Concern/C4) | **Found** — Inquietud, verbatim excerpt, cites C4's words. The strongest seed, handled exactly to spec | **Repair recognized** — not re-raised against Versión 2 ✓ |
| S3 tortillería no-return (Suggestion/C2) | **Partial** — a manuscript-level finding gestures at the pattern but cites the wrong example (Ch1's A1 control) and never names the Rodolfo anecdote | **Found precisely** (named, correct excerpt) — but raised **against Versión 2**, i.e. the repair sentence at the chapter close was not recognized. Repair-recognition failure per the pre-committed standard; editorially arguable (the return is distant from the anecdote) |
| S4 tú register break (Sug–Concern/C3) | **Missed** | **Missed** — the most Spanish-specific seed, missed twice |
| S5 no invitation Ch3 (Suggestion/C5) | **Found** — but as Inquietud (hot) and duplicated (manuscript-level + chapter-level) | **Found** again (correct; unfixed), duplicated again |
| S6 "mapa/territorio" repetition (one manuscript Suggestion) | **Missed** | **Missed** |
| S7 chronology 10 vs 15 years (Note–Suggestion) | **Missed** | **Missed** |
| N1 anaphora control | Not flagged ✓ | Not flagged ✓ |
| N2 es-MX regionalisms | Not flagged ✓ | Not flagged ✓ |
| N3 guillemets + raya | Not flagged ✓; excerpts verbatim incl. «…» —…— ✓ | ✓ |
| A1 return-to-reader control | Borderline: praised in a Nota with a mild caveat; **misused as the example** in the C2 manuscript finding | Correctly recognized as compliant (positive Nota) ✓ |

Also observed: Review B issued three *positive* Notas (compliance
observations) — not part of the matrix; harmless but inflates finding
counts. Review B's manuscript-level invitations finding wrongly
includes Chapter 2 (whose invitation is concrete) — one false positive.

## Workflow validations (all passed)

- **Response-language freezing**: both runs Español, derived from the
  manuscript language, identical prompt fingerprint; unaffected by the
  interface locale in force at request time.
- **Language independence**: with the interface set back to en-US, the
  chrome renders English ("The Findings", "CONCERN · VOICE", "raised
  against Version 2", "Deliberation — Adopted") around untouched Spanish
  stored content. Interface ≠ manuscript ≠ response language holds.
- **Traceability**: excerpts verbatim through Spanish typography;
  excerpt→version binding correct (Versión 1 vs Versión 2 tags);
  prior-run findings labeled "de una revisión anterior"; latest-session
  counts separated.
- **Deliberation / set-aside / resolve**: all three acts recorded in
  Spanish with standing (Vigencia — Adoptado) preserved across runs.
- **Versioning**: Chapter 2 Versión 2 activated; findings raised against
  v1 remained bound to v1.

## Defects measured (and their smallest corrections)

1. **create_book_with_origins regression** (Phase 2, migration 20260716
   dropped the book_documents shells + manuscripts insert; new books had
   no Memory rooms and no manuscript). Fixed: migration
   `20260718000000_restore_book_creation_shells.sql` + idempotent
   backfill. Regression pinned by phase3h_verification.ts (R1).
2. **Migration 20260707 was never applied to production** — evidenced by
   a fresh book storing `developing` and rendering the raw key
   `status.book.developing`. Applied manually during the pilot (R2 era);
   the enum now carries the eight lifecycle stages.
3. **Raw-key / English fallbacks for stored book status** — five render
   sites called `t()` unguarded (raw key on unknown values) or
   `bookStatusLabel()` (always English). Fixed with the
   `isKnownBookStatus` guard + catalog-first pattern (R3a/R3b).
4. **Admin metadata titles hardcoded in English** ("Administration"
   template; "Constitution Review — …" on run detail). Fixed via
   `generateMetadata` + catalog keys (R3c/R3d).

## Scorecard (1–5; AI-side provisional, pending human sign-off)

| Dimension | Grade | Basis |
| --- | --- | --- |
| Language correctness | 5 | All generated fields flawless Spanish; zero English leakage in review output |
| Naturalness (es-419 register) | 4 | Natural neutral LatAm register; occasional bureaucratic phrasing ("expectativa doctrinal") |
| Finding accuracy | 3 | S1/S2/S5 precise; S3 mislocated in A; A1 misattribution; internal contradiction in B |
| Traceability | 5 | Verbatim excerpts through guillemets/raya; correct version binding |
| Severity calibration | 3 | Concern-heavy: S5 expected Sugerencia, got Inquietud twice; Notas used correctly for observations |
| Category accuracy | 4 | intención/voz sensible; "conceptos" for a C2 return issue is loose |
| False-positive rate | 4 | All three no-flag controls clean in both runs; one FP (Ch2 invitations in B), one borderline (A1 Nota in A) |
| False-negative rate | **2** | S4 (register) missed twice; S6 (repetition) and S7 (continuity) missed twice |
| Duplicate rate | 3 | S5 raised at manuscript and chapter level in both runs |
| Review-summary quality | 4 | Accurate systemic framing; per-chapter paragraphs lack chapter labels when concatenated |
| Voice preservation | 5 | Never rewrote, never translated, regionalisms untouched |
| Workflow integrity | 5 | Freezing, provenance, deliberation, resolution, version binding, run separation all correct |

## Verdict (per the pre-committed bands)

**Requires another pilot** — false-negative rate = 2 triggers the band
(any dimension ≤ 2). Critical seeds S1+S2 were found in both runs, no
severe false claims, no translation of quotes, response language stable
— so this is NOT a language-layer failure:

- **The Spanish language layer passes.** Output language, register,
  typography, traceability, and the three-language model behaved at
  launch quality in both runs.
- **Editorial recall is the weak axis** — and it is likely NOT
  Spanish-specific: the missed classes (register-clause violations,
  cross-chapter repetition, continuity) are reviewer-capability gaps
  that an English manuscript would plausibly also hit. Before Pilot 2,
  run the same seed classes through an English control book to separate
  language effects from engine limits; only then tune the reviewer
  (per-pass instructions or model), keeping this pilot's gold standard
  fixed for comparability.

Human sign-off pending: a fluent Spanish reader (Esteban / designated
editor) should confirm the naturalness and severity grades before the
verdict is recorded as final.
