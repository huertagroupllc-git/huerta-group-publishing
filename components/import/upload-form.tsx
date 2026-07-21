"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ACCEPTED_MIME, MAX_FILE_SIZE_MB } from "@/lib/import/config";

/**
 * Manuscript-import upload form. Posts a PDF to /api/import/upload, then routes
 * to the preview workspace. Keyboard-accessible file input with a drag-and-drop
 * enhancement; status is announced via aria-live. All validation is echoed from
 * the server (stable codes); the client only pre-checks size for a fast message.
 */
export function ImportUploadForm({
  authorId,
  authorSlug,
}: {
  authorId: string;
  authorSlug: string;
}) {
  const t = useTranslations("import");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const pick = (f: File | null) => {
    setError("");
    if (!f) return setFile(null);
    if (f.type && f.type !== ACCEPTED_MIME && !f.name.toLowerCase().endsWith(".pdf")) {
      setError(t("errors.not_pdf"));
      return;
    }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(t("errors.too_large"));
      return;
    }
    setFile(f);
  };

  const submit = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    setStatus(t("upload.working"));
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("author_id", authorId);
      const res = await fetch("/api/import/upload", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        importId?: string;
        code?: string;
      };
      if (!res.ok || !data.ok || !data.importId) {
        const code = data.code && t.has(`errors.${data.code}`) ? data.code : "unknown";
        setError(t(`errors.${code}`));
        setStatus("");
        setBusy(false);
        return;
      }
      setStatus(t("upload.done"));
      router.push(`/workspace/authors/${authorSlug}/books/import/${data.importId}`);
    } catch {
      setError(t("errors.unknown"));
      setStatus("");
      setBusy(false);
    }
  };

  return (
    <div className="mt-10 max-w-xl">
      <label
        htmlFor="import-file"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files?.[0] ?? null);
        }}
        className="flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-rule bg-paper px-6 py-12 text-center hover:border-oxblood focus-within:border-oxblood"
      >
        <span className="font-serif text-lg text-ink">{t("upload.dropLabel")}</span>
        <span className="font-sans text-xs text-ink-faint">
          {t("upload.limits", { mb: String(MAX_FILE_SIZE_MB) })}
        </span>
        <input
          ref={inputRef}
          id="import-file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </label>

      {file ? (
        <p className="mt-4 font-sans text-sm text-ink">
          {file.name}{" "}
          <span className="text-ink-faint">
            ({(file.size / (1024 * 1024)).toFixed(1)} MB)
          </span>
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 font-sans text-sm text-oxblood">
          {error}
        </p>
      ) : null}

      <p aria-live="polite" className="mt-2 font-sans text-xs text-ink-faint">
        {status}
      </p>

      <button
        type="button"
        onClick={submit}
        disabled={!file || busy}
        className="mt-6 inline-flex items-center gap-2 bg-ink px-6 py-3 font-sans text-sm tracking-wide text-paper-bright hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
      >
        {busy ? t("upload.working") : t("upload.submit")}
        <span aria-hidden>→</span>
      </button>
    </div>
  );
}
