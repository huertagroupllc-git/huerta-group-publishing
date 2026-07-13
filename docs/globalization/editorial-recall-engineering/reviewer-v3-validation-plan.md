# Reviewer v3 — Approved Validation Plan (Phase 5, not yet executed)

Status: APPROVED design; execution requires BOTH an explicit user
authorization AND a deliberate OpenAI credit top-up (Decision 2 — the
full six-run matrix stands; current balance ≈ $0.90 is insufficient).
Reviewer v2 results (3J) and the model comparison (3K) are the fixed
comparators. Do not execute from this document alone.

## The six-run matrix (complete; not reducible to four)

All runs: Reviewer v3, hybrid policy (manuscript `gpt-5.5`, chapters
`gpt-4o`), per-reading provenance live, token ceiling active.

| # | Fixture (stable ID) | State | What the run proves |
| --- | --- | --- | --- |
| 1 | La casa que respira `b4288faf` | probe | Quoted-voice law: the unintended narrator tuteo ("Piensa… entraste…") is still found; the protected quoted «Tú ya sabes…» is NOT attributed to the narrator |
| 2 | La casa que respira II `92172416` | probe | The same pair, second independent record — repeatability is the probe's own pre-committed standard; one run cannot close a false-positive class |
| 3 | The Unready Hour III | baseline (clean-record copy) | S6 tie-breaker produces ONE consolidated Note/Suggestion; S7 continuity survives under the hybrid (gpt-5.5 wide pass with gpt-4o chapter passes around it); chapter-pass duplicate discipline holds on gpt-4o; N1–N3/A1 stay clean; mixed-model reading rows recorded correctly |
| 4 | El oficio de empezar III | baseline | The same in Spanish — bilingual parity is a stated success criterion and cannot be inferred from English alone |
| 5 | The Unready Hour `7b865172` | post-repair (record-heavy) | Six-class repair protocol against a genuine record: S2 silence preserved, S3 handled as repaired/partially repaired/residual with CURRENT-text quotes; structured-output reliability on the largest record |
| 6 | El oficio de empezar `39c3e006` | post-repair | The same in Spanish — the S3 blind re-raise was a Spanish-observed defect (3J), so Spanish is the load-bearing language for this test |

Also measured on every run: no-flag controls, severity caps,
traceability, latency per reading, token usage per reading, estimated
cost via the pricing table, token-ceiling accounting, and that
provenance never represents a hybrid run as single-model.

## Expected API exposure (provisional, not a guarantee)

Lower than the all-gpt-5.5 Phase 3K matrix (which totaled ≈ $1.84 for
eight runs): each hybrid run replaces three gpt-5.5 chapter passes
with gpt-4o. Working figure ≈ **$1.10–$1.40** for the six runs, based
solely on prior observed aggregate spend — provisional; per-token
accounting did not exist during 3K. Additional credit must be added
before execution.

## Fixture retention (all ten retained until Phase 5 completes)

| Purpose | Fixtures |
| --- | --- |
| Quoted-voice validation | La casa que respira `b4288faf`, II `92172416` |
| Baseline validation | The Unready Hour III, El oficio de empezar III |
| Post-repair validation | The Unready Hour `7b865172`, El oficio de empezar `39c3e006` |
| Repeat spares (used only if a matrix run is ambiguous) | The Unready Hour II `1448560b` + IV; El oficio de empezar II `5006f253` + IV |

Fixture authors: Eleanor Voss `b2ec948b…`, Mariana Quintero
`bb10dc66…`. Full run-ID inventory: Phase 3K results.md.

## Cleanup order after final sign-off (staff deletion workflow)

1. Delete unused repeat copies (II and IV per language).
2. Delete the baseline and post-repair books (I and III per language).
3. Delete the quoted-voice probe books (La casa que respira I/II).
4. Verify both fixture authors' deletion previews show ZERO books.
5. Delete the fixture authors.
6. Verify no orphaned review runs, findings, deliberations,
   review_run_readings, or storage artifacts remain (the deletion
   previews' live counts, including the new `readings` counter, are
   the orphan check; the audio cache remains content-addressed and
   out of scope by design).

## Human gates

Spanish 3H sign-off, English 3I sign-off, and human review of the v3
matrix output all remain required before any production-policy
approval. This plan does not authorize execution and does not declare
Spanish launch readiness.
