"use client";
import WorkspaceNavigation from "@/components/WorkspaceNavigation";
import { useLanguage } from "@/lib/useLanguage";

import DemoRoleSelector from "@/components/DemoRoleSelector";
import ApplicationCompleteness from "@/components/ApplicationCompleteness";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_URL, apiGet, Branch, Candidate } from "@/lib/api";



const TEXT = {
  pl: {
    title: "Przykładowa aplikacja e-mail",
    back: "← Wróć do kandydatów",
    notice: "Symulacja przyjęcia wiadomości e-mail. Używaj wyłącznie fikcyjnych danych. Skrzynka pocztowa nie jest połączona.",
    first: "Imię",
    last: "Nazwisko",
    email: "E-mail nadawcy",
    position: "Stanowisko",
    branch: "Oddział / miasto",
    select: "Nie podano miasta",
    subject: "Temat wiadomości",
    body: "Treść wiadomości",
    cv: "Załącznik CV — PDF",
    hint: "CV, miasto i stanowisko są opcjonalne przy przyjęciu. Braki zostaną oznaczone. Maksymalnie 5 MB; adres w domenie example.com.",
    submit: "Utwórz profil kandydata",
    saving: "Zapisywanie…",
    sample: "Wypełnij przykładowymi danymi",
    error: "Nie udało się zapisać aplikacji. Sprawdź pola i spróbuj ponownie.",
    loadError: "Nie udało się pobrać oddziałów.",
    retry: "Spróbuj ponownie",
    invalid: "Wypełnij wymagane pola i użyj adresu example.com. Załącznik może mieć maksymalnie 5 MB.",
    success: "Profil kandydata został utworzony.",
    open: "Otwórz profil",
  },
  en: {
    title: "Sample email application",
    back: "← Back to candidates",
    notice: "Simulated email intake. Use fictional data only. No mailbox is connected.",
    first: "First name",
    last: "Last name",
    email: "Sender email",
    position: "Position",
    branch: "Branch / city",
    select: "City not provided",
    subject: "Email subject",
    body: "Email body",
    cv: "CV attachment — PDF",
    hint: "CV, city and position may be missing at intake and will be flagged. Maximum 5 MB; use an example.com address.",
    submit: "Create candidate profile",
    saving: "Saving…",
    sample: "Fill with sample data",
    error: "Could not save the application. Check the fields and try again.",
    loadError: "Could not load branches.",
    retry: "Try again",
    invalid: "Complete the required fields and use an example.com address. Attachment limit: 5 MB.",
    success: "Candidate profile created successfully.",
    open: "Open profile",
  },
};

const EMPTY = {
  first_name: "",
  last_name: "",
  email: "",
  position: "",
  branch_id: "",
  email_subject: "",
  email_body: "",
};

export default function IntakePage() {
  const [canEdit, setCanEdit] = useState(false);
  const [language, changeLanguage] = useLanguage();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [fields, setFields] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<"invalid" | "error" | null>(null);
  const [created, setCreated] = useState<Candidate | null>(null);
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  const onDemoContext = useCallback((context: { role: string }) => setCanEdit(context.role !== "branch_manager"), []);
  const t = TEXT[language];


  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `SEKA — ${TEXT[language].title}`;
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(false);
    apiGet<Branch[]>("/branches", controller.signal)
      .then(setBranches)
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [retry]);


  function update(name: keyof typeof EMPTY, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
    setError(null);
  }

  function fillSample() {
    const branch = branches.find((item) => item.city === "Warszawa") ?? branches[0];
    setFields({
      first_name: "Michał",
      last_name: "Lewandowski",
      email: "michal.lewandowski@example.com",
      position: "Koordynator szkoleń",
      branch_id: branch ? String(branch.id) : "",
      email_subject: "Aplikacja — Koordynator szkoleń",
      email_body: "Dzień dobry,\nchciałbym zgłosić swoją kandydaturę na stanowisko koordynatora szkoleń. W załączniku przesyłam CV.\nPozdrawiam,\nMichał Lewandowski",
    });
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || created || !canEdit) return;

    if (
      [fields.first_name, fields.last_name, fields.email, fields.email_subject, fields.email_body].some((value) => !value.trim()) ||
      !/^[^\s@]+@example\.com$/i.test(fields.email.trim()) ||
      (file !== null && file.size > 5 * 1024 * 1024)
    ) {
      setError("invalid");
      return;
    }

    submitting.current = true;
    setSaving(true);
    setError(null);

    try {
      const body = new FormData();
      Object.entries(fields).forEach(([name, value]) => {
        if (value.trim()) body.append(name, value.trim());
      });
      if (file) body.append("file", file);

      const response = await fetch(`${API_URL}/intake/sample-email`, {
        credentials: "include",
        method: "POST",
        body,
      });
      if (!response.ok) throw new Error("Intake failed");

      const candidate: Candidate = await response.json();
      setCreated(candidate);
    } catch {
      setError("error");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <main className="workspace dashboard-workspace">
      <WorkspaceNavigation language={language} changeLanguage={changeLanguage} canEdit={canEdit} section="intake" />
      <DemoRoleSelector language={language} onContext={onDemoContext} />
      {!canEdit && <p className="demo-notice">{language === "pl" ? "Widok tylko do odczytu. Dodawanie i edycja aplikacji są dostępne dla HR i administratora." : "Read-only view. Intake and editing are available to HR and administrators."}</p>}

      <a href="/" className="back-link">{t.back}</a>
      <section className="page-heading"><h1>{t.title}</h1></section>
      <p className="demo-notice">{t.notice}</p>

      {created ? (
        <section className="panel profile-card" aria-live="polite">
          <h2>{t.success}</h2>
          <p className="success-message">
            {created.first_name} {created.last_name} · {created.branch?.city ?? (language === "pl" ? "Brak miasta" : "Missing city")}
          </p>
          <ApplicationCompleteness candidate={created} language={language} />
          <a className="secondary-button"
            href={`/candidates/${created.id}`}>{t.open}</a>
        </section>
      ) : (
        <section className="panel profile-card">
          {loadError && (
            <div role="alert">
              <p className="error">{t.loadError}</p>
              <button className="secondary-button"
                onClick={() => setRetry((value) => value + 1)}>{t.retry}</button>
            </div>
          )}

          <button type="button" className="secondary-button"
            disabled={saving || !branches.length} onClick={fillSample}>
            {t.sample}
          </button>

          <form className="intake-form" onSubmit={submit}>
            <fieldset disabled={saving || !canEdit}>
              <div className="intake-grid">
                <label>{t.first}
                  <input required maxLength={100} value={fields.first_name}
                    onChange={(e) => update("first_name", e.target.value)} />
                </label>
                <label>{t.last}
                  <input required maxLength={100} value={fields.last_name}
                    onChange={(e) => update("last_name", e.target.value)} />
                </label>
                <label>{t.email}
                  <input type="email" required maxLength={254}
                    placeholder="kandydat@example.com" value={fields.email}
                    onChange={(e) => update("email", e.target.value)} />
                </label>
                <label>{t.position}
                  <input maxLength={150} value={fields.position}
                    onChange={(e) => update("position", e.target.value)} />
                </label>
                <label>{t.branch}
                  <select value={fields.branch_id}
                    onChange={(e) => update("branch_id", e.target.value)}>
                    <option value="">{t.select}</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>{branch.city}</option>
                    ))}
                  </select>
                </label>
                <label>{t.subject}
                  <input required maxLength={255} value={fields.email_subject}
                    onChange={(e) => update("email_subject", e.target.value)} />
                </label>
                <label className="full-width">{t.body}
                  <textarea required maxLength={10000} value={fields.email_body}
                    onChange={(e) => update("email_body", e.target.value)} />
                </label>
                <label className="full-width">{t.cv}
                  <input type="file" accept=".pdf,application/pdf"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      setError(null);
                    }} />
                </label>
              </div>
              <p className="muted-text">{t.hint}</p>
              {error && <p className="error" role="alert">{t[error]}</p>}
              <button className="primary-button" type="submit"
                disabled={saving || !branches.length}>
                {saving ? t.saving : t.submit}
              </button>
            </fieldset>
          </form>
        </section>
      )}
    </main>
  );
}
