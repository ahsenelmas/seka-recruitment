"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL, apiGet, Branch, Candidate } from "@/lib/api";

type Language = "pl" | "en";

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
    select: "Wybierz oddział",
    subject: "Temat wiadomości",
    body: "Treść wiadomości",
    cv: "Załącznik CV — PDF",
    hint: "Maksymalnie 5 MB. Adres e-mail musi być w domenie example.com.",
    submit: "Utwórz profil kandydata",
    saving: "Zapisywanie…",
    sample: "Wypełnij przykładowymi danymi",
    error: "Nie udało się zapisać aplikacji. Sprawdź pola i spróbuj ponownie.",
    loadError: "Nie udało się pobrać oddziałów.",
    retry: "Spróbuj ponownie",
    invalid: "Wypełnij pola, użyj adresu example.com i wybierz PDF do 5 MB.",
    success: "Profil kandydata został utworzony.",
    open: "Otwórz profil",
    demo: "Wersja demonstracyjna",
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
    select: "Select a branch",
    subject: "Email subject",
    body: "Email body",
    cv: "CV attachment — PDF",
    hint: "Maximum 5 MB. The email address must use example.com.",
    submit: "Create candidate profile",
    saving: "Saving…",
    sample: "Fill with sample data",
    error: "Could not save the application. Check the fields and try again.",
    loadError: "Could not load branches.",
    retry: "Try again",
    invalid: "Complete the fields, use an example.com address, and choose a PDF up to 5 MB.",
    success: "Candidate profile created successfully.",
    open: "Open profile",
    demo: "Demo version",
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
  const [language, setLanguage] = useState<Language>("pl");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [fields, setFields] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState<"invalid" | "error" | null>(null);
  const [created, setCreated] = useState<Candidate | null>(null);
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  const t = TEXT[language];

  useEffect(() => {
    const saved = localStorage.getItem("seka-language");
    if (saved === "pl" || saved === "en") setLanguage(saved);
  }, []);

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

  function changeLanguage(value: Language) {
    setLanguage(value);
    localStorage.setItem("seka-language", value);
  }

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
    if (submitting.current || created) return;

    if (
      Object.values(fields).some((value) => !value.trim()) ||
      !/^[^\s@]+@example\.com$/i.test(fields.email.trim()) ||
      !file ||
      !file.name.toLowerCase().endsWith(".pdf") ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024
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
        body.append(name, value.trim());
      });
      body.append("file", file);

      const response = await fetch(`${API_URL}/intake/sample-email`, {
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
    <main className="workspace">
      <header className="topbar">
        <a href="/" className="brand">SEKA</a>
        <div className="header-actions">
          <div className="language-switch" role="group"
            aria-label={language === "pl" ? "Język interfejsu" : "Interface language"}>
            <button className={language === "pl" ? "active" : ""}
              aria-pressed={language === "pl"}
              onClick={() => changeLanguage("pl")}>Polski</button>
            <button className={language === "en" ? "active" : ""}
              aria-pressed={language === "en"}
              onClick={() => changeLanguage("en")}>English</button>
          </div>
          <span className="demo-label">{t.demo}</span>
        </div>
      </header>

      <a href="/" className="back-link">{t.back}</a>
      <section className="page-heading"><h1>{t.title}</h1></section>
      <p className="demo-notice">{t.notice}</p>

      {created ? (
        <section className="panel profile-card" aria-live="polite">
          <h2>{t.success}</h2>
          <p className="success-message">
            {created.first_name} {created.last_name} · {created.branch.city}
          </p>
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
            <fieldset disabled={saving}>
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
                  <input required maxLength={150} value={fields.position}
                    onChange={(e) => update("position", e.target.value)} />
                </label>
                <label>{t.branch}
                  <select required value={fields.branch_id}
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
                  <input type="file" required accept=".pdf,application/pdf"
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
