"use client";

import { useEffect, useState } from "react";
import { apiGet, Candidate } from "@/lib/api";

type Profile = { id: string; applications: Candidate[]; visible_application_count: number };

export default function ApplicantApplications({ candidate, language, dirty, statusLabels, badgeStyle }: {
  candidate: Candidate; language: "pl" | "en"; dirty: boolean; statusLabels: Record<string, string>; badgeStyle: (code: string) => React.CSSProperties;
}) {
  const pl = language === "pl";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setProfile(null); setError(false);
    if (candidate.applicant_id) {
      apiGet<Profile>(`/applicants/${candidate.applicant_id}`, controller.signal)
        .then(data => { if (!controller.signal.aborted) setProfile(data); })
        .catch(() => { if (!controller.signal.aborted) setError(true); });
    }
    return () => controller.abort();
  }, [candidate.applicant_id, candidate.id, candidate.updated_at, retry]);

  return <aside className="panel application-sidebar" aria-label={pl ? "Aplikacje tej osoby" : "Applications from this person"}>
    <p className="eyebrow">{pl ? "PROFIL OSOBY" : "APPLICANT PROFILE"}</p>
    <h2>{pl ? "Aplikacje tej osoby" : "Applications from this person"}</h2>
    <p className="muted-text">{pl ? "Widoczne zgłoszenia powiązane adresem e-mail. Zakres zależy od uprawnień." : "Visible submissions linked by email address. Access depends on your permissions."}</p>
    {!candidate.applicant_id ? <p role="status">{pl ? "Profil nie jest jeszcze powiązany. Sprawdź migrację i wersję API." : "Profile is not linked yet. Check the migration and API version."}</p>
      : error ? <div role="alert"><p>{pl ? "Nie udało się pobrać aplikacji." : "Could not load applications."}</p><button type="button" className="secondary-button" onClick={() => setRetry(v => v + 1)}>{pl ? "Spróbuj ponownie" : "Retry"}</button></div>
      : !profile ? <p role="status">{pl ? "Ładowanie aplikacji…" : "Loading applications…"}</p>
      : <><p className="application-count">{pl ? "Widoczne aplikacje" : "Visible applications"}: {profile.visible_application_count}</p>
      <ul className="application-list">{profile.applications.map(app => <li key={app.id}>
        <a className={`application-item ${app.id === candidate.id ? "is-current" : ""}`} href={`/candidates/${app.id}`} aria-current={app.id === candidate.id ? "page" : undefined}
          onClick={event => { if (app.id === candidate.id) { event.preventDefault(); return; } if (dirty && !window.confirm(pl ? "Opuścić stronę bez zapisywania zmian?" : "Leave without saving changes?")) event.preventDefault(); }}>
          <span className={`status-badge status-${app.status}`} style={badgeStyle(app.status)}>{statusLabels[app.status] ?? app.status}</span>
          <strong>{app.position || (pl ? "Stanowisko do ustalenia" : "Position to clarify")}</strong>
          <span>{app.branch?.city || (pl ? "Oddział do przypisania" : "Branch unassigned")}</span>
          <small>{new Date(app.created_at).toLocaleDateString(pl ? "pl-PL" : "en-GB")}{app.id === candidate.id ? (pl ? " · Bieżąca" : " · Current") : ""}</small>
        </a>
      </li>)}</ul></>}
  </aside>;
}
