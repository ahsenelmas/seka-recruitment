"use client";
import { useStatuses } from "@/lib/useStatuses";
import ApplicationWorkPanel from "@/components/ApplicationWorkPanel";
import ApplicationConversation from "@/components/ApplicationConversation";
import ApplicationHistory from "@/components/ApplicationHistory";
import ApplicantApplications from "@/components/ApplicantApplications";
import WorkspaceNavigation from "@/components/WorkspaceNavigation";
import { useLanguage } from "@/lib/useLanguage";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import DemoRoleSelector from "@/components/DemoRoleSelector";
import ApplicationCompleteness from "@/components/ApplicationCompleteness";
import CandidateCV from "@/components/CandidateCV";
import {
  API_URL,
  apiGet,
  Candidate,
  DemoContext,
  Branch,
  CandidateStatus,
} from "@/lib/api";



const TEXT = {
  pl: {
    title: "Profil kandydata",
    back: "← Wróć do aplikacji",
    contact: "Dane kontaktowe",
    email: "E-mail",
    phone: "Telefon",
    city: "Miasto",
    position: "Stanowisko",
    date: "Data aplikacji",
    process: "Proces rekrutacji",
    status: "Status rekrutacji",
    notes: "Notatki HR",
    placeholder: "Dodaj uwagi dotyczące kandydata…",
    save: "Zapisz zmiany",
    saving: "Zapisywanie…",
    saved: "Zmiany zostały zapisane.",
    saveError: "Nie udało się zapisać zmian. Spróbuj ponownie.",
    loadError: "Nie udało się pobrać profilu kandydata.",
    loading: "Ładowanie profilu…",
    retry: "Spróbuj ponownie",
    missing: "Nie podano",
    language: "Język interfejsu",
    unsaved: "Masz niezapisane zmiany.",
    cv: "Dokument CV",
    cvMissing: "Nie dodano jeszcze dokumentu CV.",
  },
  en: {
    title: "Candidate profile",
    back: "← Back to applications",
    contact: "Contact details",
    email: "Email",
    phone: "Phone",
    city: "City",
    position: "Position",
    date: "Application date",
    process: "Recruitment process",
    status: "Recruitment status",
    notes: "HR notes",
    placeholder: "Add notes about this candidate…",
    save: "Save changes",
    saving: "Saving…",
    saved: "Changes saved successfully.",
    saveError: "Could not save changes. Please try again.",
    loadError: "Could not load the candidate profile.",
    loading: "Loading profile…",
    retry: "Try again",
    missing: "Not provided",
    language: "Interface language",
    unsaved: "You have unsaved changes.",
    cv: "CV document",
    cvMissing: "No CV document has been uploaded yet.",
  },
};



const EN_POSITIONS: Record<string, string> = {
  "Specjalista ds. BHP": "Occupational health and safety specialist",
  "Koordynator szkoleń": "Training coordinator",
  "Specjalista ds. administracji": "Administration specialist",
};

export default function CandidateProfile({ candidateId, embedded = false, onDirtyChange, onSaved }: { candidateId?: string; embedded?: boolean; onDirtyChange?: (dirty: boolean) => void; onSaved?: (candidate: Candidate) => void } = {}) {
  const routeParams = useParams<{ id: string }>();
  const id = candidateId ?? routeParams.id;
  const searchParams = useSearchParams();
  const [workDirty, setWorkDirty] = useState(false);
  const [conversationDirty, setConversationDirty] = useState(false);
  const [context, setContext] = useState<DemoContext | null>(null);
  const permissions = context?.permissions ?? [];
  const allowed = (permission: string) => permissions.includes(permission);
  const canEdit = ["applications.edit_status", "applications.edit_notes", "applications.edit_position", "applications.assign_branch"].some(permission => permissions.includes(permission));
  const [language, changeLanguage] = useLanguage();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [status, setStatus] = useState<CandidateStatus>("new");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [position, setPosition] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<"saved" | "error" | null>(null);
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState<"overview" | "documents" | "correspondence" | "notes" | "history" | "work">(searchParams.get("tab") === "work" ? "work" : "overview");

  const onDemoContext = useCallback((context: DemoContext) => setContext(context), []);
  const t = TEXT[language];
  const { statuses, labels: statusLabels, badgeStyle, error: statusesError } = useStatuses(language, retry);
  const dirty = candidate !== null &&
    (status !== candidate.status || notes !== candidate.hr_notes ||
      branchId !== String(candidate.branch?.id ?? "") || position !== (candidate.position ?? ""));

  useEffect(() => {
    if (!embedded) return;
    const controller = new AbortController();
    apiGet<DemoContext>("/demo/context", controller.signal).then(value => { if (!controller.signal.aborted) setContext(value); }).catch(() => {});
    return () => controller.abort();
  }, [embedded]);
  useEffect(() => {
    onDirtyChange?.(dirty || conversationDirty || workDirty);
    return () => onDirtyChange?.(false);
  }, [dirty, conversationDirty, workDirty, onDirtyChange]);
  const Container = embedded ? "section" : "main";


  useEffect(() => {
    document.documentElement.lang = language;
    if (!embedded) document.title = `SEKA — ${TEXT[language].title}`;
  }, [language, embedded]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    setMessage(null);
    setCandidate(null);

    Promise.all([
      apiGet<Candidate>(`/candidates/${id}`, controller.signal),
      apiGet<Branch[]>("/branches", controller.signal),
    ]).then(([data, branchList]) => {
        setBranches(branchList);
        setBranchId(String(data.branch?.id ?? ""));
        setPosition(data.position ?? "");
        setCandidate(data);
        setStatus(data.status);
        setNotes(data.hr_notes);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [id, retry]);

  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);


  async function saveChanges(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!candidate || saving || !canEdit) return;

    const payload: Record<string, unknown> = {};
    if (allowed("applications.edit_status") && status !== candidate.status) payload.status = status;
    if (allowed("applications.edit_notes") && notes !== candidate.hr_notes) payload.hr_notes = notes;
    if (allowed("applications.assign_branch") && branchId !== String(candidate.branch?.id ?? "")) payload.branch_id = branchId ? Number(branchId) : null;
    if (allowed("applications.edit_position") && position !== (candidate.position ?? "")) payload.position = position.trim() || null;
    if (!Object.keys(payload).length) return;
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/candidates/${id}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Save failed");

      const updated: Candidate = await response.json();
      setCandidate(updated);
      onSaved?.(updated);
      setBranchId(String(updated.branch?.id ?? ""));
      setPosition(updated.position ?? "");
      setStatus(updated.status);
      setNotes(updated.hr_notes);
      setMessage("saved");
    } catch {
      setMessage("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Container className={embedded ? "embedded-profile" : "workspace dashboard-workspace"}>
      {!embedded && <WorkspaceNavigation language={language} changeLanguage={changeLanguage} canEdit={canEdit} section="profile" />}
      {!embedded && <DemoRoleSelector language={language} onContext={onDemoContext} />}
      {!embedded && !canEdit && <p className="demo-notice">{language === "pl" ? "Brak uprawnień do edycji pól tej aplikacji." : "You do not have permission to edit this application’s fields."}</p>}

      {!embedded && <a href="/applications" className="back-link">{t.back}</a>}

      {loading ? (
        <p className="empty-state">{t.loading}</p>
      ) : loadError || !candidate ? (
        <div className="empty-state">
          <p className="error" role="alert">{t.loadError}</p>
          <button className="secondary-button"
            onClick={() => setRetry((value) => value + 1)}>{t.retry}</button>
        </div>
      ) : (
        <>
          <section className="page-heading">
            <div>
              <p className="eyebrow">{t.title}</p>
              <h1>{candidate.first_name} {candidate.last_name}</h1>
              <p>
                {language === "en"
                  ? EN_POSITIONS[candidate.position ?? ""] ?? candidate.position ?? t.missing
                  : candidate.position ?? t.missing}
                {" · "}{candidate.branch?.city ?? t.missing}
              </p>
            </div>
            <div className="profile-heading-actions">{embedded && <a className="secondary-button" href={`/candidates/${id}`}>{language === "pl" ? "Pełny profil ↗" : "Full profile ↗"}</a>}<span className={`status-badge status-${candidate.status}`} style={badgeStyle(candidate.status)}>
              {statusLabels[candidate.status] ?? candidate.status}
            </span></div>
          </section>

          {statusesError && <p className="error" role="alert">{language === "pl" ? "Nie udało się pobrać statusów. Odśwież stronę." : "Could not load statuses. Refresh the page."}</p>}
          <div className="application-workspace">
          {!embedded && <ApplicantApplications candidate={candidate} language={language} dirty={dirty || conversationDirty || workDirty} statusLabels={statusLabels} badgeStyle={badgeStyle} />}
          <div className="application-detail">
          <nav className="application-tabs" aria-label={language === "pl" ? "Szczegóły aplikacji" : "Application details"}>
            {([
              ["overview", language === "pl" ? "Przegląd" : "Overview"],
              ["documents", language === "pl" ? "CV i dokumenty" : "CV & documents"],
              ["notes", language === "pl" ? "Status i notatki" : "Status & notes"],
              ["correspondence", language === "pl" ? "Korespondencja" : "Correspondence"],
              ["work", language === "pl" ? "Opiekun i zadania" : "Owner & tasks"],
              ["history", language === "pl" ? "Historia" : "History"],
            ] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={view === key} onClick={() => { if (key !== view && (conversationDirty || workDirty) && !window.confirm(language === "pl" ? "Opuścić widok bez zapisania zmian?" : "Leave this view without saving changes?")) return; setView(key); }}>{label}</button>)}
          </nav>
          {view === "work" && (context?.permissions.includes("tasks.view") ? <ApplicationWorkPanel key={candidate.id} candidateId={candidate.id} context={context} language={language} onDirtyChange={setWorkDirty} /> : <p className="empty-state">{language === "pl" ? "Brak dostępu do zadań." : "You cannot view tasks."}</p>)}
          {view === "history" && <ApplicationHistory key={`${candidate.id}-${candidate.updated_at}`} candidateId={candidate.id} language={language} statusLabels={statusLabels} />}
          <div hidden={view !== "overview"}>
          <section className="panel profile-card completeness-panel">
            <h2>{language === "pl" ? "Kompletność aplikacji" : "Application completeness"}</h2>
            <ApplicationCompleteness candidate={candidate} language={language} />
            {candidate.cv_validation_error && <p className="muted-text">{language === "pl" ? candidate.cv_validation_error : "The attachment could not be accepted. Upload a readable, unencrypted PDF."}</p>}
          </section>

          </div>
          {view === "correspondence" && (context?.permissions.includes("correspondence.view") ? <ApplicationConversation key={candidate.id} candidateId={candidate.id} language={language} context={context} onDirtyChange={setConversationDirty} /> : <p className="empty-state">{language === "pl" ? "Brak dostępu do korespondencji." : "You cannot view correspondence."}</p>)}
          <div className="profile-grid application-profile-grid">
            <section className="panel profile-card" hidden={view !== "overview" && view !== "documents"}>
              <div hidden={view !== "overview"}>
              <h2>{t.contact}</h2>
              <dl className="detail-list">
                <div><dt>{t.email}</dt><dd>{candidate.email}</dd></div>
                <div><dt>{t.phone}</dt><dd>{candidate.phone || t.missing}</dd></div>
                <div><dt>{t.city}</dt><dd>{candidate.branch?.city ?? t.missing}</dd></div>
                <div>
                  <dt>{t.position}</dt>
                  <dd>{language === "en"
                    ? EN_POSITIONS[candidate.position ?? ""] ?? candidate.position ?? t.missing
                    : candidate.position ?? t.missing}</dd>
                </div>
                <div>
                  <dt>{t.date}</dt>
                  <dd>{new Date(candidate.created_at).toLocaleDateString(
                    language === "pl" ? "pl-PL" : "en-GB",
                  )}</dd>
                </div>
              </dl>
              </div>
              <div hidden={view !== "documents"}>
              <h2>{t.cv}</h2>
              {allowed("cv.view") ? <CandidateCV
                key={candidate.id}
                readOnly={!allowed("cv.upload")}
                candidateId={candidate.id}
                filename={candidate.cv_original_filename}
                language={language}
                onUploaded={(updated) => {
                  setCandidate((current) => current ? {
                    ...current,
                    cv_original_filename: updated.cv_original_filename,
                    cv_validation_error: updated.cv_validation_error,
                    missing_information: updated.missing_information,
                    is_complete: updated.is_complete,
                    follow_up_email: updated.follow_up_email,
                  } : current);
                }}
              /> : <p>{language === "pl" ? "Twoja rola nie ma dostępu do CV." : "Your role cannot access CVs."}</p>}
              </div>
            </section>

            <section className="panel profile-card" hidden={view !== "notes"}>
              <h2>{t.process}</h2>
              <form className="profile-form" onSubmit={saveChanges}>
                <label>{t.city}
                  <select value={branchId} disabled={saving || !allowed("applications.assign_branch")} onChange={e => { setBranchId(e.target.value); setMessage(null); }}>
                    <option value="">{t.missing}</option>
                    {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.city}</option>)}
                  </select>
                </label>
                <label>{t.position}
                  <input value={position} maxLength={150} disabled={saving || !allowed("applications.edit_position")}
                    onChange={e => { setPosition(e.target.value); setMessage(null); }} />
                </label>
                <label>
                  {t.status}
                  <select value={status} disabled={saving || !allowed("applications.edit_status")}
                    onChange={(event) => {
                      setStatus(event.target.value as CandidateStatus);
                      setMessage(null);
                    }}>
                    {statuses.filter(item => item.is_active || item.code === candidate.status).map(item => (
                      <option key={item.code} value={item.code}>{statusLabels[item.code]}{!item.is_active ? (language === "pl" ? " (archiwalny)" : " (archived)") : ""}</option>
                    ))}
                  </select>
                </label>

                <label>
                  {t.notes}
                  <textarea value={notes} maxLength={10000}
                    placeholder={t.placeholder} disabled={saving || !allowed("applications.edit_notes")}
                    onChange={(event) => {
                      setNotes(event.target.value);
                      setMessage(null);
                    }} />
                </label>

                {dirty && <p className="muted-text">{t.unsaved}</p>}
                <div aria-live="polite">
                  {message === "saved" && <p className="success-message">{t.saved}</p>}
                  {message === "error" && <p className="error" role="alert">{t.saveError}</p>}
                </div>

                <button type="submit" className="primary-button"
                  disabled={saving || !dirty || !canEdit || statusesError || statuses.length === 0}>
                  {saving ? t.saving : t.save}
                </button>
              </form>
            </section>
          </div>
          </div>
          </div>
        </>
      )}
    </Container>
  );
}


