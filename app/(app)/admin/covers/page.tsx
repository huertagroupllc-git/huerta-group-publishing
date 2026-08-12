import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionMessage, ActionNotice } from "@/components/action-message";
import { Field, QuietButton } from "@/components/editorial";
import {
  actionMessageFromQuery,
  actionNoticeFromQuery,
} from "@/lib/action-messages";
import { recordCoverAsset } from "@/lib/publication/cover-actions";
import {
  HGP_TRADE_6X9_COVER_V1,
  coverProfileFingerprint,
} from "@/lib/publication/cover-profile";
import { shortFingerprint } from "@/lib/publication/types";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("publication.coverAdmin");
  return { title: t("metaTitle") };
}

/**
 * Administration › Cover Production — the governed input registries:
 * the immutable Cover Profile and the Cover Asset ledger. Assets are
 * recorded with required rights evidence; the platform never creates
 * or transforms artwork.
 */
export default async function AdminCoversPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const sp = await searchParams;
  const t = await getTranslations("publication.coverAdmin");
  const tNav = await getTranslations("navigation");
  const format = await getFormatter();
  const date = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "medium" });

  const { data: assets } = await supabase
    .from("cover_assets")
    .select(
      "id, asset_key, display_name, kind, sha256, byte_size, width_px, height_px, rights_evidence, recorded_at, books(title)",
    )
    .order("recorded_at", { ascending: false })
    .limit(100);

  const message = actionMessageFromQuery(sp);
  const notice = actionNoticeFromQuery(sp);
  const profile = HGP_TRADE_6X9_COVER_V1;

  return (
    <>
      <p className="eyebrow">{tNav("administration")}</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight">
        {t("heading")}
      </h1>
      <p className="mt-6 max-w-prose text-lg leading-relaxed text-ink-soft">
        {t("lede")}
      </p>
      <ActionMessage
        code={message?.code}
        params={message?.params}
        namespace="publication.errors"
        legacyText={false}
      />
      <ActionNotice
        code={notice?.code}
        params={notice?.params}
        namespace="publication.notices"
      />

      <section aria-labelledby="cover-profile" className="mt-8">
        <h3 id="cover-profile" className="eyebrow">
          {t("profileHeading")}
        </h3>
        <p className="mt-2 max-w-prose text-sm text-ink-soft">
          {t("profileLine", {
            name: profile.displayName,
            version: profile.version,
            interior: profile.interiorProfileKey,
          })}{" "}
          · {shortFingerprint(coverProfileFingerprint(profile))} ·{" "}
          {t("paperLine", { ppi: profile.paperPpi })}
        </p>
      </section>

      <section aria-labelledby="cover-assets" className="mt-10">
        <h3 id="cover-assets" className="eyebrow">
          {t("assetsHeading")}
        </h3>
        {(assets ?? []).length === 0 ? (
          <p className="mt-3 max-w-prose text-sm italic text-ink-soft">
            {t("assetsEmpty")}
          </p>
        ) : (
          <ul className="mt-4 space-y-3 text-sm">
            {(assets ?? []).map((a) => {
              const book = a.books as unknown as { title: string } | null;
              return (
                <li key={a.id} className="rule pt-3">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span>{a.display_name}</span>
                    <span className="font-mono text-xs text-ink-faint">
                      {a.asset_key}
                    </span>
                    <span className="text-ink-faint">
                      {a.width_px}×{a.height_px} · {a.kind}
                    </span>
                    <span className="text-ink-faint">{date(a.recorded_at)}</span>
                  </div>
                  <p className="mt-1 max-w-prose font-sans text-xs text-ink-soft">
                    {book ? `${book.title} · ` : t("houseAsset") + " · "}
                    {t("rightsLine", { evidence: a.rights_evidence })}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[10px] text-ink-faint">
                    sha256 {a.sha256}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="cover-record" className="mt-12">
        <h3 id="cover-record" className="eyebrow">
          {t("recordHeading")}
        </h3>
        <p className="mt-2 max-w-prose font-sans text-xs text-ink-soft">
          {t("recordLede")}
        </p>
        <form action={recordCoverAsset} className="mt-4 grid max-w-md gap-3">
          <div>
            <label className="eyebrow block" htmlFor="asset_file">
              {t("form.fileLabel")}
            </label>
            <input
              id="asset_file"
              name="asset_file"
              type="file"
              accept="image/jpeg"
              className="mt-1 w-full font-sans text-sm"
              required
            />
          </div>
          <Field
            id="asset_key"
            label={t("form.keyLabel")}
            required
            hint={t("form.keyHint")}
          />
          <Field id="display_name" label={t("form.nameLabel")} required />
          <Field
            id="rights_evidence"
            label={t("form.rightsLabel")}
            required
            hint={t("form.rightsHint")}
          />
          <Field
            id="book_id"
            label={t("form.bookLabel")}
            optional
            hint={t("form.bookHint")}
          />
          <div>
            <QuietButton>{t("form.recordSubmit")}</QuietButton>
          </div>
        </form>
      </section>
    </>
  );
}
