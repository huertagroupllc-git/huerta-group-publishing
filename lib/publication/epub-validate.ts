import { readZipEntries } from "@/lib/publication/zip";

/**
 * The HGP EPUB structural validator (Phase 3 WP-310) — the gate every
 * generated EPUB must pass before a Publication Artifact may be
 * recorded. Deterministic, dependency-free, and focused on the OCF /
 * package facts that make an EPUB openable and internally coherent:
 * container requirements, manifest/spine/nav reference integrity, and
 * required metadata. It is not a full conformance suite (EPUBCheck
 * remains the industry reference for that, run out-of-band); its scope
 * and version are recorded on every artifact so the guarantee is
 * always interpretable.
 */

export const VALIDATOR_ID = "hgp-epub-structural";
export const VALIDATOR_VERSION = "1.0.0";

export interface ValidationCheck {
  code: string;
  ok: boolean;
  detail?: string;
}

export interface ValidationResult {
  valid: boolean;
  checks: ValidationCheck[];
}

function attr(source: string, name: string): string | null {
  const m = source.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : null;
}

export function validateEpub(bytes: Buffer): ValidationResult {
  const checks: ValidationCheck[] = [];
  const push = (code: string, ok: boolean, detail?: string) => {
    checks.push(detail ? { code, ok, detail } : { code, ok });
  };

  const entries = readZipEntries(bytes);
  const byName = new Map(entries.map((e) => [e.name, e]));

  // OCF: mimetype must be the first entry, stored, with the exact type.
  const first = entries[0];
  push(
    "mimetypeFirstStoredExact",
    Boolean(
      first &&
        first.name === "mimetype" &&
        first.method === 0 &&
        first.data.toString("ascii") === "application/epub+zip",
    ),
  );

  const container = byName.get("META-INF/container.xml");
  push("containerPresent", Boolean(container));
  const fullPath = container
    ? attr(container.data.toString("utf8"), "full-path")
    : null;
  push("containerNamesPackage", Boolean(fullPath));
  const pkg = fullPath ? byName.get(fullPath) : undefined;
  push("packagePresent", Boolean(pkg), fullPath ?? undefined);
  if (!pkg) return { valid: false, checks };

  const pkgSource = pkg.data.toString("utf8");
  const pkgDir = fullPath!.split("/").slice(0, -1).join("/");
  const resolve = (href: string) => (pkgDir ? `${pkgDir}/${href}` : href);

  const packageTag = pkgSource.match(/<package\s[^>]*>/)?.[0] ?? "";
  push("packageVersion", attr(packageTag, "version") === "3.0");
  push(
    "requiredMetadata",
    /<dc:identifier[^>]*>[^<]+<\/dc:identifier>/.test(pkgSource) &&
      /<dc:title>[^<]*<\/dc:title>/.test(pkgSource) &&
      /<dc:language>[^<]+<\/dc:language>/.test(pkgSource) &&
      /property="dcterms:modified">\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z</.test(
        pkgSource,
      ),
  );

  const items = [...pkgSource.matchAll(/<item\s[^>]*\/>/g)].map((m) => m[0]);
  const ids = new Map<string, string>();
  let manifestResolves = true;
  for (const item of items) {
    const id = attr(item, "id");
    const href = attr(item, "href");
    if (!id || !href) {
      manifestResolves = false;
      continue;
    }
    ids.set(id, href);
    if (!byName.has(resolve(href))) {
      manifestResolves = false;
      push("manifestMissingFile", false, href);
    }
  }
  push("manifestReferencesResolve", manifestResolves);

  push(
    "navDeclared",
    items.some((i) => attr(i, "properties") === "nav"),
  );

  const idrefs = [...pkgSource.matchAll(/<itemref\s[^>]*\/>/g)]
    .map((m) => attr(m[0], "idref"))
    .filter((x): x is string => Boolean(x));
  push(
    "spineReferencesResolve",
    idrefs.length > 0 && idrefs.every((id) => ids.has(id)),
  );

  const navItem = items.find((i) => attr(i, "properties") === "nav");
  const navHref = navItem ? attr(navItem, "href") : null;
  const nav = navHref ? byName.get(resolve(navHref)) : undefined;
  push("navPresent", Boolean(nav));
  if (nav) {
    const hrefs = [...nav.data.toString("utf8").matchAll(/href="([^"#]+)/g)]
      .map((m) => m[1]);
    push(
      "navReferencesResolve",
      hrefs.length > 0 && hrefs.every((h) => byName.has(resolve(h))),
    );
  } else {
    push("navReferencesResolve", false);
  }

  // Well-formedness floor for our XML/XHTML entries: an XML declaration
  // and no bare ampersands (all references must be entities).
  let xmlSane = true;
  for (const entry of entries) {
    if (!/\.(xhtml|opf|xml)$/.test(entry.name)) continue;
    const text = entry.data.toString("utf8");
    if (!text.startsWith("<?xml ")) xmlSane = false;
    if (/&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/.test(text)) {
      xmlSane = false;
      push("bareAmpersand", false, entry.name);
    }
  }
  push("xmlDeclarationsAndEntities", xmlSane);

  return { valid: checks.every((c) => c.ok), checks };
}
