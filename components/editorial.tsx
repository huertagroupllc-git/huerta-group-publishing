import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

/**
 * House patterns for the editorial desk — the shared primitives already in
 * use across the workspace, extracted once. Not a design system.
 * See docs/constitution/design-constitution.md.
 */

/** The one filled action per view (Design Constitution §6). */
export function PrimaryButton({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="submit"
      className={`bg-oxblood px-6 py-2.5 font-sans text-sm tracking-wide text-paper hover:bg-oxblood-deep ${className}`}
      {...props}
    />
  );
}

/** Secondary act: hairline-bordered, quiet. */
export function QuietButton({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="submit"
      className={`border border-rule px-6 py-2.5 font-sans text-sm tracking-wide text-ink hover:border-oxblood hover:text-oxblood ${className}`}
      {...props}
    />
  );
}

/** Tertiary act rendered as a small sans button (inside a form). */
export function TextButton({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type="submit"
      className={`font-sans text-xs text-oxblood underline-offset-4 hover:underline ${className}`}
      {...props}
    />
  );
}

/** Tertiary act rendered as a small sans link. */
export function ActionLink({
  className = "",
  ...props
}: ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      className={`font-sans text-xs text-oxblood underline-offset-4 hover:underline ${className}`}
      {...props}
    />
  );
}

const inputClasses =
  "w-full border-b border-rule bg-transparent py-2 font-serif text-lg text-ink " +
  "placeholder:text-ink-faint focus:border-oxblood focus:outline-none";

function FieldLabel({
  htmlFor,
  label,
  optional,
  hint,
}: {
  htmlFor: string;
  label: string;
  optional?: boolean;
  hint?: string;
}) {
  return (
    <label htmlFor={htmlFor} className="eyebrow block">
      {label}
      {optional ? <span className="normal-case"> (optional)</span> : null}
      {hint ? <span className="normal-case"> ({hint})</span> : null}
    </label>
  );
}

/** Single-line field: eyebrow label over a hairline-underlined serif input. */
export function Field({
  id,
  label,
  optional,
  hint,
  ...props
}: { id: string; label: string; optional?: boolean; hint?: string } & Omit<
  ComponentPropsWithoutRef<"input">,
  "id" | "className"
>) {
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} optional={optional} hint={hint} />
      <input id={id} name={id} className={inputClasses} {...props} />
    </div>
  );
}

/** Multi-line field: hairline-bordered serif textarea at reading size. */
export function TextareaField({
  id,
  label,
  optional,
  hint,
  ...props
}: { id: string; label: string; optional?: boolean; hint?: string } & Omit<
  ComponentPropsWithoutRef<"textarea">,
  "id" | "className"
>) {
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} optional={optional} hint={hint} />
      <textarea
        id={id}
        name={id}
        className="mt-2 w-full border border-rule bg-transparent p-4 font-serif text-lg leading-relaxed text-ink focus:border-oxblood focus:outline-none"
        {...props}
      />
    </div>
  );
}

/** Select rendered in the same register as Field. */
export function SelectField({
  id,
  label,
  options,
  ...props
}: {
  id: string;
  label: string;
  options: { value: string; label: string }[];
} & Omit<ComponentPropsWithoutRef<"select">, "id" | "className">) {
  return (
    <div>
      <FieldLabel htmlFor={id} label={label} />
      <select
        id={id}
        name={id}
        className="w-full border-b border-rule bg-transparent py-2 font-serif text-lg text-ink focus:border-oxblood focus:outline-none"
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
