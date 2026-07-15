# Reviewer v4 — Human sign-off corrections (Phase 6)

Status: implemented (prompt-layer only; **no paid rerun executed** in this
phase). Follows the completed six-run hybrid validation matrix and the
owner's human editorial sign-off of its output.

## 1. The six-run human sign-off

The authorized six-run Reviewer v3 hybrid matrix (manuscript `gpt-5.5`,
chapters `gpt-4o`) completed cleanly at the execution layer — 6/6 Complete,
zero failed readings, zero retries, correct hybrid provenance, bilingual,
correct token/cached/latency instrumentation, no infrastructure defect.
Human editorial review then identified **one confirmed defect** and **one
narrower reasoning concern**, against a backdrop of preserved successes.

## 2. Confirmed defect — quoted speech mis-scored as narrator voice

- Fixture: **La casa que respira**.
- Reviewer finding: "Inconsistencia en el tratamiento al lector."
- Evidence the reviewer cited: «Tú ya sabes cómo es esta casa; no la dejes
  sola.»
- Human verdict: **FAIL.** This is protected quoted speech belonging to a
  speaker inside the manuscript, not narrator-to-reader address. Reviewer v3
  applied the narrator's formal *usted* convention to quoted dialogue and
  treated the quoted speaker's *tú* as a voice violation. This is exactly
  what the quoted-voice probe was built to catch.

## 3. Paired control — genuine narrator tuteo correctly detected

- Fixture: **La casa que respira II**.
- Reviewer finding: "Cambio inconsistente de tratamiento al lector."
- Evidence: *Piensa en la última vez que entraste a esa casa.*
- Human verdict: **PASS.** This is real narrator-to-reader language in the
  informal second person; the reviewer correctly flagged it.

The control proves the reviewer understands the *usted*/*tú* distinction.
**The defect is not register detection — it is speaker attribution before
register evaluation.**

## 4. Secondary concern — metaphor multiplicity treated as inconsistency

- Fixture: **El oficio de empezar**.
- Reviewer finding: "Analogías inconsistentes sobre el miedo" — brújula,
  termómetro, señal treated as conceptual inconsistency without proving the
  metaphors contradict one another.
- Human verdict: **Questionable / possible false positive.** Multiple
  metaphors may be complementary. Concept inconsistency should require a
  demonstrated semantic contradiction, incompatible function, or concrete
  reader-confusion risk — mere multiplicity is insufficient.

## 5. Responsible-layer diagnosis

Both corrections belong to the **prompt layer**, not context assembly and
not evidence validation:

- **Context is adequate.** The manuscript pass ships every chapter *in full,
  verbatim* (`lib/review/constitution.ts` → `chapter.content.trim()`, joined
  under `=== … ===` headers). Quotation marks (incl. Spanish guillemets
  «…») and surrounding narration reach the model intact, so the reviewer had
  the attribution context needed to distinguish speaker from narrator. It
  did not strip or lose it.
- The v3 quoted-voice law (prompt.ts law 7) already *stated* that quoted
  speech belongs to its speaker, but did not force **speaker identification
  as a required first step before** any register/address judgment. The model
  detected the *tú* and skipped straight to a register verdict.
- Concept consistency is evaluated only through the manuscript-integrity
  **continuity** check; that check protected "intentional development" and
  "mere variation" but did not explicitly rule out *multiplicity of
  metaphors* as a contradiction.

Conclusion: strengthen two instruction texts; do not touch the engine,
hybrid architecture, schema, or context assembly.

## 6. Exact before/after instruction text

### Quoted-voice law (shared, `lib/editorial-ai/prompt.ts`, law 7)

Before (v3):
> "Speech inside quotation marks of any convention — dialogue, quoted
> remarks, testimony, cited speech — belongs to its speaker, never to the
> book's narrative voice. A quoted person may address anyone in any
> register; that is their voice, not the manuscript's. Evaluate register,
> address, and tone conventions only against the narration itself, and flag
> a voice violation only where the governing narrative voice breaks the
> convention the governing documents establish. Deliberate code-switching
> and character voice are the author's craft."

After (v4):
> "Before evaluating register, form of address, tone, or reader
> relationship, identify the speaker of the cited words. Speech inside
> quotation marks of any convention — dialogue, quoted remarks, testimony,
> remembered speech, cited speech, epigraphs, and attributed remarks —
> belongs to its speaker, never automatically to the book's narrative voice.
> A quoted person may address anyone in any register; that is their voice,
> not the manuscript's. Do not treat a quoted speaker's pronouns, register,
> commands, or tone as a violation of the governing narrative voice unless
> the surrounding text clearly presents those words as the narrator's own
> address or adopts them as the book's governing voice. If speaker
> attribution is uncertain, do not raise a voice or register finding from
> the quotation alone — evaluate the narration outside the quotation. Flag a
> voice violation only where the governing narrative voice itself breaks the
> convention the governing documents establish. Deliberate code-switching,
> character voice, quoted voices, dialogue, and stylistic contrast are the
> author's craft."

Language-neutral: no Spanish-specific rule; the law reads identically in the
English- and Spanish-output prompts.

### Concept-consistency threshold (`lib/review/constitution.ts`, `CONTINUITY_CHECK`)

Appended:
> "Multiplicity is not inconsistency: multiple metaphors, analogies, images,
> or explanatory frames for one concept are not a contradiction merely
> because they differ. Raise a concept-consistency finding only when the
> manuscript assigns the same concept meanings, functions, causes, facts, or
> implications that cannot reasonably coexist — name the exact incompatibility
> and explain what the reader cannot reconcile. Complementary metaphors,
> layered analogies, pedagogical reframing, motif development, and
> perspective shifts are protected; describing different dimensions of one
> concept that can coexist is not a finding."

Everything preserved: the true-contradiction definition and the
severity-capped continuity/repetition design are unchanged.

## 7. Version and fingerprint changes

- Reviewer version **3 → 4** (`constitution.ts`; stated in every prompt as
  "reviewer version 4"). Model changes remain wholly separate from the
  prompt fingerprint (the prompt contains no model identifier).
- New default prompt fingerprints (`sha256(systemPrompt)`, first 12 hex):
  - English: **`d54e97e64b86`** (was v3 `a1dc3ed16691`; v2 `adcf5da0002c`)
  - Spanish: **`78ec5271fe14`** (was v3 `5933d0266770`; v2 `e54b3f7f0e1a`)
- Historical runs keep their frozen version and fingerprint; nothing is
  rewritten or backfilled. Continue Review reads a run's frozen prompt/policy,
  never the live definition.

## 8. Regression coverage

`phase_reviewer_v3_s4_verification.ts` gains a "Reviewer v4 human-signoff
corrections" block (V4-1…V4-10): speaker-attribution-first, the protected
speech taxonomy, "evaluate narration outside the quotation", the
uncertainty rule, no-narrator-assignment, language-neutrality, "multiplicity
is not inconsistency", the exact-incompatibility requirement, the
complementary-metaphor protections, an intact true-contradiction path, and a
context-assembly fixture proving the «Tú ya sabes…» quote and the *Piensa…*
narrator line both survive verbatim (guillemets intact). Version and both
new fingerprints are pinned and asserted distinct from all historical v2/v3
values. Every prior-phase version guard was updated 3 → 4.

## 9. No paid rerun in this phase

No review run was created or continued; no completion model was called; no
fixture (incl. La casa que respira and The Conversational Mind) was run; the
`gpt-5.5` manuscript override and all Vercel config were left untouched.

## 10. Minimal future rerun plan (requires explicit owner authorization)

1. Rerun **La casa que respira** — the protected quotation must no longer be
   flagged as narrator tuteo; a legitimate narrator/directive concern may
   remain.
2. Rerun **La casa que respira II** — the genuine narrator tuteo must still
   be flagged (control must still pass).
3. Optional: one concept/metaphor fixture, only if a deterministic fixture
   can isolate complementary metaphors vs a true contradiction.

Estimated exposure ≈ **$0.02–$0.15** (two small single-chapter Spanish
probes at the same hybrid policy; ~6k tokens each — an estimate from the
matrix's observed per-run usage, not a billed figure). This plan is **not**
authorized by this document.
