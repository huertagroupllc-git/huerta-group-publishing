/**
 * Application messages for server actions — the reusable localization
 * pattern (established in Phase 3B for Author Memory; later subsystem
 * actions adopt the same shape).
 *
 * A server action never carries English prose through a redirect.
 * It carries a STABLE MESSAGE IDENTIFIER plus safe interpolation
 * parameters; the receiving page translates at the presentation
 * boundary in the request's interface locale (components/
 * action-message.tsx). Raw database errors never reach the user —
 * they are logged server-side and mapped to a code.
 *
 * The identifier doubles as the message key inside one catalog
 * namespace (e.g. memory.errors). Arbitrary query text can never be
 * interpreted as a key: the renderer checks membership first and
 * falls back safely.
 */

export interface ActionMessage {
  /** Stable code — also the translation key within the namespace. */
  code: string;
  /** Safe interpolation values (plain text, ICU arguments — never
   *  markup, never translation keys). */
  params?: Record<string, string>;
  /** The field the message concerns, when it concerns one. Transported
   *  for field-level targeting; current forms render one note per form. */
  field?: string;
}

const PARAM_PREFIX = "m_";
const FIELD_KEY = "mf";

/** Serialize a message onto a redirect path's query string. */
export function withActionMessage(path: string, msg: ActionMessage): string {
  const [base, existing] = path.split("?");
  const sp = new URLSearchParams(existing ?? "");
  sp.set("error", msg.code);
  for (const [k, v] of Object.entries(msg.params ?? {})) {
    sp.set(`${PARAM_PREFIX}${k}`, v);
  }
  if (msg.field) sp.set(FIELD_KEY, msg.field);
  return `${base}?${sp.toString()}`;
}

/** Recover a message from a page's resolved searchParams. Unknown or
 *  absent input yields null; values are plain strings only. */
export function actionMessageFromQuery(
  query: Record<string, string | string[] | undefined>,
): ActionMessage | null {
  const code = query.error;
  if (typeof code !== "string" || !code) return null;
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (k.startsWith(PARAM_PREFIX) && typeof v === "string") {
      params[k.slice(PARAM_PREFIX.length)] = v;
    }
  }
  const field = typeof query[FIELD_KEY] === "string" ? query[FIELD_KEY] : undefined;
  return { code, params, field };
}
