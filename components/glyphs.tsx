/**
 * Hairline editorial glyphs (Design Constitution §5): thin, monochrome,
 * always secondary to typography. Never icon-only actions, never colored,
 * never emoji. Drawn at stroke 1.25 on a 24 grid, sized by the parent.
 */

function Glyph({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`h-6 w-6 ${className}`}
    >
      {children}
    </svg>
  );
}

/** A charter: a sheet bearing ruled clauses and a seal. */
export function ConstitutionGlyph({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M6 3.5h12v17H6z" />
      <path d="M9 8h6M9 11h6M9 14h3" />
      <circle cx="15.5" cy="16.5" r="1.5" />
    </Glyph>
  );
}

/** A structure: entries set at their levels. */
export function OutlineGlyph({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M5 6h14M8 11h11M8 16h7" />
      <path d="M5 11h.01M5 16h.01" />
    </Glyph>
  );
}

/** An open book: facing pages. */
export function DictionaryGlyph({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M12 6.5c-1.8-1.6-4.2-2-7-2v13c2.8 0 5.2.4 7 2 1.8-1.6 4.2-2 7-2v-13c-2.8 0-5.2.4-7 2z" />
      <path d="M12 6.5v13" />
    </Glyph>
  );
}

/** The quiet affordance that a row opens. */
export function OpensGlyph({ className }: { className?: string }) {
  return (
    <Glyph className={className}>
      <path d="M5 12h13M14 7.5l4.5 4.5-4.5 4.5" />
    </Glyph>
  );
}
