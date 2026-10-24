"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api";

type Event = { id: number; type: string; actor_role: string; simulated: boolean; created_at: string; changes: Record<string, unknown> };
type Page = { data: Event[]; current_page: number; last_page: number };
const TITLES: Record<string, [string, string]> = { reply_draft_created: ["Zapisano szkic odpowiedzi", "Reply draft saved"], reply_draft_updated: ["Zmieniono szkic odpowiedzi", "Reply draft updated"], sample_email_received: ["Dodano fikcyjną wiadomość", "Fictional message added"], application_created: ["Otrzymano aplikację", "Application created"], application_updated: ["Zaktualizowano aplikację", "Application updated"], cv_uploaded: ["Dodano dokument CV", "CV uploaded"] };
const FIELDS: Record<string, [string, string]> = { message_id: ["Identyfikator wiadomości", "Message ID"], status: ["Status", "Status"], branch_id: ["Identyfikator oddziału", "Branch ID"], position: ["Stanowisko", "Position"], hr_notes: ["Zmieniono notatki HR", "HR notes changed"], filename: ["Plik", "File"] };
const ROLES: Record<string, [string,string]> = { admin: ["Administrator", "Administrator"], hr_manager: ["HR", "HR manager"], branch_manager: ["Kierownik oddziału", "Branch manager"], system: ["System", "System"] };

export default function ApplicationHistory({ candidateId, language, statusLabels }: { candidateId: string; language: "pl" | "en"; statusLabels: Record<string, string> }) {
  const pl = language === "pl", lang = pl ? 0 : 1;
  const [page, setPage] = useState(1), [retry, setRetry] = useState(0);
  const [data, setData] = useState<Page | null>(null), [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError(false);
    apiGet<Page>(`/candidates/${candidateId}/history?page=${page}`, controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [candidateId, page, retry]);
  function value(field: string, input: unknown): string {
    if (input === null || input === "") return pl ? "Nie podano" : "Not provided";
    return field === "status" && typeof input === "string" ? statusLabels[input] ?? input : String(input);
  }
  return <section className="panel profile-card"><h2>{pl ? "Historia aplikacji" : "Application history"}</h2>
    <p className="muted-text">{pl ? "Historia obejmuje zdarzenia od włączenia rejestrowania. Wcześniejsze zmiany nie zostały odtworzone." : "History covers events recorded since tracking was enabled. Earlier changes have not been reconstructed."}</p>
    {error ? <div role="alert"><p>{pl ? "Nie udało się pobrać historii." : "Could not load history."}</p><button type="button" className="secondary-button" onClick={() => setRetry(v => v + 1)}>{pl ? "Ponów" : "Retry"}</button></div>
      : !data ? <p role="status">{pl ? "Ładowanie…" : "Loading…"}</p>
      : <>{!data.data.length && <p>{pl ? "Brak zarejestrowanych zdarzeń." : "No recorded events yet."}</p>}
      <ol className="history-list">{data.data.map(event => <li key={event.id}>
        <strong>{TITLES[event.type]?.[lang] ?? event.type}</strong>
        <p className="muted-text"><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(pl ? "pl-PL" : "en-GB")}</time>{" · "}{ROLES[event.actor_role]?.[lang] ?? event.actor_role}{event.simulated ? (pl ? " (rola symulowana)" : " (simulated role)") : ""}</p>
        <ul>{Object.entries(event.changes).map(([field, change]) => <li key={field}>{FIELDS[field]?.[lang] ?? field}{field === "hr_notes" ? "" : change && typeof change === "object" && "before" in change && "after" in change ? `: ${value(field, change.before)} → ${value(field, change.after)}` : `: ${value(field, change)}`}</li>)}</ul>
      </li>)}</ol>
      <div className="history-pagination"><button type="button" className="secondary-button" disabled={page <= 1} onClick={() => setPage(v => v - 1)}>{pl ? "Nowsze" : "Newer"}</button><span>{data.current_page} / {data.last_page}</span><button type="button" className="secondary-button" disabled={page >= data.last_page} onClick={() => setPage(v => v + 1)}>{pl ? "Starsze" : "Older"}</button></div></>}
  </section>;
}
