# Spanish Editorial Pilot — Design & Gold Standard

Status: authored BEFORE any review run (Phase 3H discipline: expected
results are documented first and never tailored to model output).
All pilot content is original Spanish, written specifically for this
pilot and approved for repository storage. July 2026.

## Pilot book profile

- **Author (pilot)**: Mariana Quintero — created as a normal author
  record; clearly a pilot persona, documented here.
- **Book**: *El oficio de empezar* — nonfiction for first-time
  founders in Latin America about starting before feeling ready.
- **Manuscript language tag**: `es-MX` (exercises variant granularity;
  the interface pilot locale remains es-419 — three languages, three
  facts).
- **Structure**: Book Constitution + Master Outline (Spanish), three
  substantive chapters (~600 words each) with deliberate stylistic and
  structural variation, guillemets and raya dialogue, es-MX regional
  vocabulary, and a controlled seed set below.
- **Reviews**: Review A (baseline, all readings), then one controlled
  revision of Chapter 2 + resolution, then Review B (post-revision).

## The Constitution's six governing clauses (the reviewer's law)

C1 Promise: the book exists so a first-time founder takes the first
   step before feeling ready.
C2 Every personal anecdote must return to the reader's situation.
C3 The book addresses the reader as **usted**, never tú.
C4 The book **never promises financial results** or guaranteed
   formulas.
C5 Every chapter ends with an explicit invitation to act.
C6 The tone explores; it never legislates universal laws.

## Seeded issue matrix (gold standard)

| # | Location | Seed | Expected category | Expected severity | Constitution clause | Must-not misread |
|---|---|---|---|---|---|---|
| S1 | Ch1, ¶4 | Universal law: "Todos los emprendedores que esperan fracasan; es una ley sin excepciones." | intent / voice | **Concern** (Inquietud) | C6 | Not a style nit; it contradicts the exploratory tone clause |
| S2 | Ch2, ¶5 | Financial guarantee: "recuperará su inversión en menos de tres meses. Eso se lo garantizo." | intent | **Concern** | C4 | The strongest seed; must cite C4's own words |
| S3 | Ch2, ¶2–3 | Anecdote (uncle Rodolfo's tortillería) never returns to the reader | reader_experience / intent | **Suggestion** | C2 | The anecdote itself is good prose; the issue is the missing return |
| S4 | Ch3, ¶3 | Register break: three sentences switch to tú ("tú ya sabes lo que se siente…") | voice | **Suggestion–Concern** | C3 | Not a typo; a systematic register clause violation |
| S5 | Ch3, ending | Chapter ends in abstraction, no invitation to act | structure | **Suggestion** | C5 | Chapter-local, not manuscript-level |
| S6 | All 3 chapters | Metaphor "el mapa no es el territorio" recurs in every chapter | repetition | **Suggestion** (manuscript-level, ONE finding) | — | Should be systemic/manuscript-wide, not three chapter findings |
| S7 | Ch1, ¶2 vs ¶6 | Chronology wobble: "hace diez años" vs "hace quince años" for the same event | continuity | **Note–Suggestion** | — | Same event, two distances |
| N1 | Ch2, ¶6 | Intentional anaphora: "Empiece antes… Empiece cuando… Empiece aunque…" | — | **No finding** (or explicit style observation at most) | — | Deliberate rhetoric; flagging it as careless repetition = false positive |
| N2 | Ch1 throughout | es-MX regionalisms: "platicar", "ahorita", "changarro" | — | **No finding** | — | Regional vocabulary is the manuscript's voice, not an error |
| N3 | Ch3, ¶2 | Dialogue in guillemets + raya: «Nadie está listo» —me dijo— «pero el pan se hornea igual.» | — | **No finding**; quotes must survive extraction verbatim | — | Punctuation must not break traceability |
| A1 | Ch1, ¶5 | Alignment success: anecdote explicitly returns to the reader ("Usted no necesita mi historia; necesita la suya…") | — | No finding — honors C2 | C2 | Control for false positives on anecdotes |

**Acceptable variation**: wording of findings may differ; category may
reasonably vary between adjacent categories (intent/voice); severity
within the stated range. **Unacceptable**: missing S1 or S2; flagging
N1–N3/A1 as defects; translating quoted passages; English output in
any generated field; forcing S6 into per-chapter duplicates without a
systemic framing.

## Scorecard dimensions & thresholds

Scale 1–5 per dimension (5 = launch quality). Dimensions: language
correctness · naturalness (es-419 register) · finding accuracy ·
traceability · severity calibration · category accuracy ·
false-positive rate · false-negative rate · duplicate rate ·
review-summary quality · voice preservation · workflow integrity.

Verdict bands: **Approved** = all dims ≥ 4, S1+S2 found, zero severe
false claims, human editor sign-off. **Approved with corrections** =
one dim = 3 with a documented small fix + retest. **Requires another
pilot** = any dim ≤ 2 or a missed critical seed. **Blocked** = severe
false claims, translation of quotes, or unstable response language.

Human review: the final grade requires a fluent Spanish reader's
sign-off (Esteban / designated editor). AI-side grading informs; it
does not approve.

## Execution notes (deviations recorded, gold standard unchanged)

- **Manuscript tag stored as `es`, not `es-MX`**: the platform's
  language selector deliberately offers macro-languages only
  (SELECTABLE_LANGUAGES); es-MX is a KNOWN tag (display/storage) but
  not user-selectable. The phase spec allows "es or a more specific
  valid tag", so the book is stored as `es`; the manuscript itself
  carries es-MX voice (N2 regionalisms), which is what the seeds
  exercise. Variant-tag selection remains future product work.
- The seeded matrix and expected results above were not modified after
  the reviews ran; grading lives in pilot-results.md.
