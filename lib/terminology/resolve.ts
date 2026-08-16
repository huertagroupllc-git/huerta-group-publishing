import "server-only";

import { getTranslations } from "next-intl/server";
import {
  EDITORIAL_RELATIONSHIPS,
  EDITORIAL_TERMS,
  type EditorialTermId,
  type ResolvedRelationship,
  type ResolvedTerm,
} from "@/lib/terminology/editorial-terms";

/** Every governed term with its words in the request's interface
 *  locale — the Glossary's content, and the contextual help's. */
export async function resolveEditorialTerms(): Promise<ResolvedTerm[]> {
  const t = await getTranslations("terminology.terms");
  return EDITORIAL_TERMS.map((term) => ({
    id: term.id,
    name: t(`${term.id}.name`),
    contextual: t(`${term.id}.contextual`),
    glossary: t(`${term.id}.glossary`),
    descriptive: term.descriptive,
  }));
}

export async function resolveEditorialTerm(
  id: EditorialTermId,
): Promise<ResolvedTerm> {
  const terms = await resolveEditorialTerms();
  const term = terms.find((x) => x.id === id);
  if (!term) throw new Error(`Unknown editorial term: ${id}`);
  return term;
}

export async function resolveEditorialRelationships(): Promise<
  ResolvedRelationship[]
> {
  const t = await getTranslations("terminology.relationships");
  return EDITORIAL_RELATIONSHIPS.map((r) => ({
    id: r.id,
    name: t(`${r.id}.name`),
    meaning: t(`${r.id}.meaning`),
  }));
}

export interface GlossaryUi {
  title: string;
  intro: string;
  open: string;
  openAria: string;
  close: string;
  contextualLabel: string;
  glossaryLabel: string;
  relationshipsHeading: string;
  descriptiveNote: string;
  descriptiveLabel: string;
  sourceNote: string;
}

export async function resolveGlossaryUi(): Promise<GlossaryUi> {
  const t = await getTranslations("terminology.ui");
  return {
    title: t("glossaryTitle"),
    intro: t("glossaryIntro"),
    open: t("open"),
    openAria: t("openAria"),
    close: t("close"),
    contextualLabel: t("contextualLabel"),
    glossaryLabel: t("glossaryLabel"),
    relationshipsHeading: t("relationshipsHeading"),
    descriptiveNote: t("descriptiveNote"),
    descriptiveLabel: t("descriptiveLabel"),
    sourceNote: t("sourceNote"),
  };
}
