import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import {
  deriveChannelState,
  publishedObservations,
  type ChannelEventFact,
  type DerivedChannelState,
  type PublishedObservation,
} from "@/lib/publication/release-state";

/** The Release Record read models (Blueprint §12, §21). */

export interface ChannelRegistryEntry {
  id: string;
  code: string;
  display_name: string;
  kind: "internal" | "external";
  retired_at: string | null;
}

export interface EvidenceView {
  id: string;
  kind: string;
  value: string;
  source: string | null;
  effective_at: string | null;
  effective_precision: "exact" | "date" | null;
  recorded_at: string;
  corrects_evidence_id: string | null;
}

export interface ChannelEventView extends ChannelEventFact {
  effective_at: string | null;
  effective_precision: "exact" | "date" | null;
  note: string | null;
  evidence: EvidenceView[];
}

export interface ParticipationView {
  id: string;
  channel: ChannelRegistryEntry;
  channel_note: string | null;
  created_at: string;
  events: ChannelEventView[];
  derived: DerivedChannelState;
}

export interface ReleaseEventView {
  id: string;
  event_type: "withdrawal" | "supersession" | "amendment" | "correction";
  recorded_at: string;
  note: string | null;
  corrects_event_id: string | null;
  related_release_id: string | null;
}

export interface ReleaseView {
  id: string;
  candidate_number: number;
  candidate_fingerprint: string;
  artifact_number: number;
  artifact_checksum: string;
  serializer: string;
  serializer_version: string;
  declared_at: string;
  reason: string | null;
  disposition: "active" | "withdrawn" | "superseded";
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  superseded_by_release_id: string | null;
  artifact_id: string;
  participations: ParticipationView[];
  events: ReleaseEventView[];
}

export interface ReleaseDesk {
  channels: ChannelRegistryEntry[];
  releases: ReleaseView[];
  observations: PublishedObservation[];
}

const RELEASE_COLUMNS =
  "id, candidate_number, candidate_fingerprint, artifact_id, artifact_number, artifact_checksum, serializer, serializer_version, declared_at, reason, disposition, withdrawn_at, withdrawal_reason, superseded_by_release_id";

export const getReleaseDesk = cache(async function getReleaseDesk(
  bookId: string,
  bookStatus: string,
): Promise<ReleaseDesk> {
  const supabase = await createClient();
  const [channelsResult, releasesResult] = await Promise.all([
    supabase
      .from("release_channels")
      .select("id, code, display_name, kind, retired_at")
      .order("code"),
    supabase
      .from("publication_releases")
      .select(
        `${RELEASE_COLUMNS},
         release_channel_participations(id, channel_note, created_at,
           release_channels(id, code, display_name, kind, retired_at),
           release_channel_events(id, event_type, recorded_at, effective_at,
             effective_precision, note, corrects_event_id,
             release_evidence(id, kind, value, source, effective_at,
               effective_precision, recorded_at, corrects_evidence_id))),
         release_events(id, event_type, recorded_at, note,
           corrects_event_id, related_release_id)`,
      )
      .eq("book_id", bookId)
      .order("declared_at", { ascending: false }),
  ]);

  const channels = (channelsResult.data ?? []) as ChannelRegistryEntry[];

  const releases: ReleaseView[] = (releasesResult.data ?? []).map((r) => {
    const disposition = r.disposition as ReleaseView["disposition"];
    const participations: ParticipationView[] = (
      r.release_channel_participations ?? []
    ).map((p) => {
      const events: ChannelEventView[] = (p.release_channel_events ?? [])
        .map((e) => ({
          id: e.id as string,
          event_type:
            e.event_type as ChannelEventView["event_type"],
          recorded_at: e.recorded_at as string,
          corrects_event_id: e.corrects_event_id as string | null,
          effective_at: e.effective_at as string | null,
          effective_precision:
            e.effective_precision as ChannelEventView["effective_precision"],
          note: e.note as string | null,
          evidence: (e.release_evidence ?? []) as EvidenceView[],
          hasEvidence: (e.release_evidence ?? []).length > 0,
        }))
        .sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
      return {
        id: p.id as string,
        channel: p.release_channels as unknown as ChannelRegistryEntry,
        channel_note: p.channel_note as string | null,
        created_at: p.created_at as string,
        events,
        derived: deriveChannelState(events, disposition),
      };
    });
    return {
      ...(r as unknown as ReleaseView),
      disposition,
      participations,
      events: ((r.release_events ?? []) as ReleaseEventView[]).sort((a, b) =>
        a.recorded_at.localeCompare(b.recorded_at),
      ),
    };
  });

  const observations = publishedObservations(
    bookStatus,
    releases.map((r) => ({
      disposition: r.disposition,
      channelStates: r.participations.map((p) => p.derived.state),
    })),
  );

  return { channels, releases, observations };
});
