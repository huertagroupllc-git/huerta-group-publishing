import type { ReactNode } from "react";

/**
 * Presentational settings controls for the Author Settings room (S2).
 * Server components: they receive already-translated strings and never
 * reproduce inheritance logic — the caller resolves effective values and
 * sources through the S1 resolver.
 *
 * The inherit-aware controls make "inherit vs override" explicit in the
 * control itself: a select's empty option (and the emphasis "use system
 * default" checkbox) writes NULL, which the resolver reads as inherit.
 */

const selectClasses =
  "mt-2 w-full border-b border-rule bg-transparent py-2 font-serif text-lg " +
  "text-ink focus:border-oxblood focus:outline-none";

function SourceLine({ text }: { text: string }) {
  return (
    <p className="mt-1 font-sans text-[0.6875rem] italic text-ink-faint">
      {text}
    </p>
  );
}

/** A select whose first option ("") means inherit the system default. */
export function InheritSelect({
  id,
  label,
  description,
  systemDefaultLabel,
  sourceText,
  value,
  options,
}: {
  id: string;
  label: string;
  description: string;
  systemDefaultLabel: string;
  sourceText: string;
  value: string | null;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow block">
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={value ?? ""}
        className={selectClasses}
      >
        <option value="">{systemDefaultLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <p className="mt-2 font-sans text-xs text-ink-faint">{description}</p>
      <SourceLine text={sourceText} />
    </div>
  );
}

/** Emphasis multi-select: up to two areas, or inherit. The "inherit"
 *  checkbox writes NULL; unchecking it makes the selection explicit — an
 *  empty explicit selection ([]) is distinct from inherit. */
export function EmphasisField({
  legend,
  description,
  maxNote,
  systemDefaultLabel,
  sourceText,
  inherited,
  selected,
  options,
}: {
  legend: string;
  description: string;
  maxNote: string;
  systemDefaultLabel: string;
  sourceText: string;
  inherited: boolean;
  selected: string[];
  options: { value: string; label: string }[];
}) {
  const noteId = "emphasis-max-note";
  return (
    <fieldset aria-describedby={noteId}>
      <legend className="eyebrow">{legend}</legend>
      <p className="mt-2 font-sans text-xs text-ink-faint">{description}</p>
      <p id={noteId} className="mt-1 font-sans text-xs text-ink-soft">
        {maxNote}
      </p>

      <label className="mt-4 flex items-center gap-2.5">
        <input
          type="checkbox"
          name="emphasis_inherit"
          defaultChecked={inherited}
          className="h-4 w-4 accent-oxblood"
        />
        <span className="font-sans text-sm text-ink">{systemDefaultLabel}</span>
      </label>

      <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2.5">
            <input
              type="checkbox"
              name="emphasis"
              value={o.value}
              defaultChecked={selected.includes(o.value)}
              className="h-4 w-4 accent-oxblood"
            />
            <span className="font-serif text-base text-ink">{o.label}</span>
          </label>
        ))}
      </div>
      <SourceLine text={sourceText} />
    </fieldset>
  );
}

/** A settings section wrapper: heading, note, its form(s), and a quiet
 *  reset control that returns the whole section to inheritance. */
export function SettingsSection({
  heading,
  note,
  children,
}: {
  heading: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <section className="rule mt-14 pt-6">
      <h2 className="eyebrow">{heading}</h2>
      <p className="mt-3 max-w-prose font-sans text-sm leading-relaxed text-ink-soft">
        {note}
      </p>
      <div className="mt-8">{children}</div>
    </section>
  );
}
