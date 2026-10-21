"use client";
import WorkspaceNavigation from "@/components/WorkspaceNavigation";
import { useLanguage } from "@/lib/useLanguage";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DemoRoleSelector from "@/components/DemoRoleSelector";
import ApplicationCompleteness from "@/components/ApplicationCompleteness";
import FollowUpEmailPreview from "@/components/FollowUpEmailPreview";
import CandidateCV from "@/components/CandidateCV";
import {
  API_URL,
  apiGet,
  Candidate,
  Branch,
  CandidateStatus,
  STATUS_LABELS,
} from "@/lib/api";



const TEXT = {
  pl: {
    title: "Profil kandydata",
    back: "← Wróć do kandydatów",
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
    back: "← Back to candidates",
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

const EN_STATUSES: Record<CandidateStatus, string> = {
  new: "New application",
  review: "Under review",
  interview: "Interview",
  hired: "Hired",
  rejected: "Rejected",
};

const EN_POSITIONS: Record<string, string> = {
  "Specjalista ds. BHP": "Occupational health and safety specialist",
  "Koordynator szkoleń": "Training coordinator",
  "Specjalista ds. administracji": "Administration specialist",
};

export default function CandidateProfile() {
  const { id } = useParams<{ id: string }>();
  const [canEdit, setCanEdit] = useState(false);
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

  const onDemoContext = useCallback((context: { role: string }) => setCanEdit(context.role !== "branch_manager"), []);
  const t = TEXT[language];
  const statusLabels = language === "pl" ? STATUS_LABELS : EN_STATUSES;
  const dirty = candidate !== null &&
    (status !== candidate.status || notes !== candidate.hr_notes ||
      branchId !== String(candidate.branch?.id ?? "") || position !== (candidate.position ?? ""));


  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `SEKA — ${TEXT[language].title}`;
  }, [language]);

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

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_URL}/candidates/${id}`, {
        credentials: "include",
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, hr_notes: notes, branch_id: branchId ? Number(branchId) : null, position: position.trim() || null }),
      });
      if (!response.ok) throw new Error("Save failed");

      const updated: Candidate = await response.json();
      setCandidate(updated);
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
    <main className="workspace dashboard-workspace">
      <WorkspaceNavigation language={language} changeLanguage={changeLanguage} canEdit={canEdit} section="profile" />
      <DemoRoleSelector language={language} onContext={onDemoContext} />
      {!canEdit && <p className="demo-notice">{language === "pl" ? "Widok tylko do odczytu. Dodawanie i edycja aplikacji są dostępne dla HR i administratora." : "Read-only view. Intake and editing are available to HR and administrators."}</p>}

      <a href="/" className="back-link">{t.back}</a>

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
            <span className={`status-badge status-${candidate.status}`}>
              {statusLabels[candidate.status]}
            </span>
          </section>

          <section className="panel profile-card completeness-panel">
            <h2>{language === "pl" ? "Kompletność aplikacji" : "Application completeness"}</h2>
            <ApplicationCompleteness candidate={candidate} language={language} />
            {candidate.cv_validation_error && <p className="muted-text">{language === "pl" ? candidate.cv_validation_error : "The attachment could not be accepted. Upload a readable, unencrypted PDF."}</p>}
          </section>

          <FollowUpEmailPreview
            key={`${candidate.id}-${candidate.updated_at}-${candidate.missing_information.join(",")}`}
            email={candidate.follow_up_email} language={language} dirty={dirty}
          />

          {candidate.email_subject && (
            <section className="panel profile-card email-original">
              <h2>{language === "pl" ? "Oryginalna wiadomość e-mail" : "Original email"}</h2>
              <p className="muted-text">
                {language === "pl" ? "Nadawca" : "Sender"}: {candidate.email}
              </p>
              <h3>{candidate.email_subject}</h3>
              <p className="email-body">{candidate.email_body}</p>
            </section>
          )}

          <div className="profile-grid">
            <section className="panel profile-card">
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
              <CandidateCV
                key={candidate.id}
                readOnly={!canEdit}
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
              />
            </section>

            <section className="panel profile-card">
              <h2>{t.process}</h2>
              <form className="profile-form" onSubmit={saveChanges}>
                <label>{t.city}
                  <select value={branchId} disabled={saving || !canEdit} onChange={e => { setBranchId(e.target.value); setMessage(null); }}>
                    <option value="">{t.missing}</option>
                    {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.city}</option>)}
                  </select>
                </label>
                <label>{t.position}
                  <input value={position} maxLength={150} disabled={saving || !canEdit}
                    onChange={e => { setPosition(e.target.value); setMessage(null); }} />
                </label>
                <label>
                  {t.status}
                  <select value={status} disabled={saving || !canEdit}
                    onChange={(event) => {
                      setStatus(event.target.value as CandidateStatus);
                      setMessage(null);
                    }}>
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  {t.notes}
                  <textarea value={notes} maxLength={10000}
                    placeholder={t.placeholder} disabled={saving || !canEdit}
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
                  disabled={saving || !dirty || !canEdit}>
                  {saving ? t.saving : t.save}
                </button>
              </form>
            </section>
          </div>
        </>
      )}
    </main>
  );
}


