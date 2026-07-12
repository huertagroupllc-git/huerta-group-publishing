# Spanish Register Probe — Design & Gold Standard

Committed BEFORE any probe run (3J discipline). The probe isolates one
question: does the reviewer, under Constitution Review v2, detect an
unintended tú/usted register break in Spanish when the constitution
makes register constitutional — and does it protect an intentional
quoted switch? Two independent identical copies, one run each; the
probe passes a class only if the behavior repeats in both runs.

## Probe manuscript — *La casa que respira* (es)

One chapter (~200 words), author Mariana Quintero (reconstructed pilot
persona). Two identical copies: probe books P1 and P2.

### Constitution (two clauses only)

Este libro acompaña a quien está por heredar o dejar una casa
familiar. Sus fronteras:

Primera. Este libro le habla de usted, siempre. Nunca tutea al lector;
el respeto es parte de la voz. Las voces citadas de otras personas
hablan como hablaron.

Segunda. El tono acompaña, no receta: este libro no dicta pasos
universales; camina junto al lector.

### Chapter — "Las llaves" (seeds annotated; markers not pasted)

Toda casa heredada llega con más llaves que puertas. Usted lo sabrá
pronto: habrá una llave que no abra nada y una puerta que no tenga
llave, y las dos le van a doler.

Cuando mi abuela me entregó las suyas, me dijo sin ceremonia: «Tú ya
sabes cómo es esta casa; no la dejes sola.» [P-N1: quoted tú — must
NOT be flagged] Las guardé en el bolsillo y no supe qué hacer con
ellas durante meses.

Piensa en la última vez que entraste a esa casa. ¿Qué oíste? [P-S1:
unintended tú/tuteo — MUST be flagged, voice, citing the Primera
frontera] Vuelva a esa escena con calma: el sonido de una casa es su
respiración, y usted puede aprender a escucharla sin miedo.

No le daré un método de siete pasos; nadie honesto puede dárselo. Le
propongo apenas un comienzo: esta semana, abra una sola habitación,
una que evite, y quédese en ella cinco minutos, sin ordenar nada.

### Expected results (fixed)

| Seed | Expectation |
| --- | --- |
| P-S1 (tuteo: "Piensa… entraste… oíste") | ONE voice finding, Suggestion–Concern, citing "Nunca tutea al lector" (or the clause's words) |
| P-N1 (quoted «Tú ya sabes…») | NO finding — the constitution itself exempts quoted voices |
| Controls | No invented findings about the honest-method paragraph (it honors the Segunda) |

### Decision rule (fixed)

- Detected in BOTH runs, quote protected in both → **no correction
  needed**; close the register question (the 3H misses were v1-era
  model behavior, possibly mitigated by v2's fuller context).
- Detected in NEITHER run → repeatable Spanish-specific weakness →
  design the smallest LANGUAGE-CONVENTION overlay (versioned,
  fingerprinted, selected by response/manuscript language) per the
  phase's overlay rule.
- Split (1 of 2) → nondeterminism dominates; do NOT add an overlay on
  this evidence; record as unresolved and re-probe with a larger
  sample before any overlay.
- Quoted tú flagged in either run → false-positive regression; weigh
  against any overlay that sharpens register attention.
