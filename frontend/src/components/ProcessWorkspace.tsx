"use client";
import { useEffect, useState } from "react";
import { API_URL, apiGet, Candidate, DemoContext } from "@/lib/api";
import { useStatuses } from "@/lib/useStatuses";

type Application = Candidate & {
  process_version: number;
  main_state: string;
  hr_support_required: boolean;
  qualification_required: boolean;
  future_consent: boolean;
  consent_evidence: string | null;
  completed_at: string | null;
  interview_at: string | null;
  interview_format: string | null;
  rejection_reason: string | null;
};
type RecordRow = {
  id: number;
  actor_label: string;
  process_status: string;
  content?: string;
  message_id?: string;
  created_at: string;
  event_code?: string;
  purpose_code?: string;
  phone_outcome?: string;
  occurred_at?: string;
  reviewer_id?: string;
  stage?: string;
  decision?: string;
  opinion?: string;
  version?: number;
  employee_id?: string;
  expires_at?: string;
};
type Meta = {
  dictionaries: {
    id: number;
    kind: string;
    code: string;
    label_pl: string;
    label_en: string;
    is_active: boolean;
  }[];
  employees: { id: string; name: string; role_code: string }[];
};
type Data = {
  application: Application;
  notes: RecordRow[];
  contacts: RecordRow[];
  reviews: RecordRow[];
  grants: RecordRow[];
  paging?: Record<
    string,
    { current_page: number; last_page: number; total: number }
  >;
};
export default function ProcessWorkspace({
  candidateId,
  context,
  language,
  onDirtyChange,
  onSaved,
}: {
  candidateId: string;
  context: DemoContext;
  language: "pl" | "en";
  onDirtyChange: (v: boolean) => void;
  onSaved: (c: Candidate) => void;
}) {
  const pl = language === "pl",
    t = (a: string, b: string) => (pl ? a : b);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Data | null>(null),
    [meta, setMeta] = useState<Meta | null>(null),
    [tab, setTab] = useState("process"),
    [dirty, setDirty] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(false),
    [reload, setReload] = useState(0);
  const { statuses, labels } = useStatuses(language);
  const allows = (p: string) => context.permissions.includes(p);
  const canGrant = context.scope === "all" && allows("qualification.request");
  useEffect(() => {
    const c = new AbortController();
    setError("");
    Promise.all([
      apiGet<Data>(
        `/p01/applications/${candidateId}?${tab === "access" ? "grants" : tab}_page=${page}`,
        c.signal,
      ),
      apiGet<Meta>("/p01/meta", c.signal),
    ])
      .then(([d, m]) => {
        if (!c.signal.aborted) {
          setData(d);
          setMeta(m);
        }
      })
      .catch(() => {
        if (!c.signal.aborted)
          setError(
            t("Nie udało się pobrać procesu.", "Could not load the process."),
          );
      });
    return () => c.abort();
  }, [candidateId, reload, language, tab, page]);
  useEffect(() => {
    onDirtyChange(dirty);
    return () => onDirtyChange(false);
  }, [dirty, onDirtyChange]);
  async function send(path: string, body: object, method = "POST") {
    if (busy) return false;
    setBusy(true);
    setError("");
    setSuccess(false);
    try {
      const response = await fetch(
        `${API_URL}/p01/applications/${candidateId}/${path}`,
        {
          method,
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.message ?? t("Nie zapisano zmian.", "Changes were not saved."),
        );
      if (path === "process") onSaved(result);
      setDirty(false);
      setSuccess(true);
      setReload((v) => v + 1);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function fields(form: HTMLFormElement) {
    return Object.fromEntries(new FormData(form).entries()) as Record<
      string,
      string
    >;
  }
  function date(value?: string | null) {
    return value ? new Date(value).toLocaleString(pl ? "pl-PL" : "en-GB") : "—";
  }
  function local(value?: string | null) {
    if (!value) return "";
    const d = new Date(value);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  }
  function dictionary(code?: string) {
    const d = meta?.dictionaries.find((i) => i.code === code);
    return d ? (pl ? d.label_pl : d.label_en) : (code ?? "—");
  }
  if (!data || !meta)
    return (
      <div className="panel profile-card">
        {error ? (
          <>
            <p className="error">{error}</p>
            <button
              className="secondary-button"
              onClick={() => setReload((v) => v + 1)}
            >
              {t("Ponów", "Retry")}
            </button>
          </>
        ) : (
          t("Ładowanie procesu…", "Loading process…")
        )}
      </div>
    );
  const c = data.application;
  const tabs = [
    ["process", t("Proces", "Process")],
    ["notes", t("Notatki", "Notes")],
    ["contacts", t("Kontakty", "Contact events")],
    ["reviews", t("Kompetencje", "Qualifications")],
    ...(canGrant ? [["access", t("Dostęp", "Access")]] : []),
  ];
  return (
    <section className="p01-workflow">
      <div className="p01-process-summary">
        <div>
          <span className={`phase phase-${c.main_state}`}>
            {
              (
                {
                  new: t("Nowy", "New"),
                  in_progress: t("W trakcie", "In progress"),
                  finished: t("Zakończony", "Finished"),
                } as Record<string, string>
              )[c.main_state]
            }
          </span>
          <h2>{labels[c.status] ?? c.status}</h2>
        </div>
        <small>
          {t(
            "Każda aplikacja jest niezależna",
            "Every application is independent",
          )}
        </small>
      </div>
      <nav
        className="p01-subtabs"
        aria-label={t("Proces rekrutacji", "Recruitment process")}
      >
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? "active" : ""}
            onClick={() => {
              if (
                tab !== key &&
                dirty &&
                !confirm(
                  t(
                    "Opuścić bez zapisania zmian?",
                    "Leave without saving changes?",
                  ),
                )
              )
                return;
              setDirty(false);
              setSuccess(false);
              setPage(1);
              setTab(key);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="success-message">
          {t("Zapisano.", "Saved.")}
        </p>
      )}
      {tab === "process" && (
        <form
          key={c.process_version}
          className="p01-form"
          onChange={() => setDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            const d = fields(e.currentTarget);
            await send(
              "process",
              {
                version: c.process_version,
                status: d.status,
                hr_support_required: d.hr_support_required === "on",
                qualification_required: d.qualification_required === "on",
                future_consent: d.future_consent === "on",
                consent_evidence: d.consent_evidence || null,
                interview_at: d.interview_at
                  ? new Date(d.interview_at).toISOString()
                  : null,
                interview_format: d.interview_format || null,
                rejection_reason: d.rejection_reason || null,
              },
              "PATCH",
            );
          }}
        >
          <fieldset disabled={busy || !allows("process.manage")}>
            <div className="p01-fields">
              <label>
                {t("Status procesu", "Process status")}
                <select name="status" defaultValue={c.status}>
                  {statuses
                    .filter(
                      (s) =>
                        (s.is_active &&
                          ![
                            "new",
                            "review",
                            "interview",
                            "hired",
                            "rejected",
                          ].includes(s.code)) ||
                        s.code === c.status,
                    )
                    .map((s) => (
                      <option key={s.code} value={s.code}>
                        {labels[s.code]}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                {t("Termin rozmowy", "Interview date")}
                <input
                  type="datetime-local"
                  name="interview_at"
                  defaultValue={local(c.interview_at)}
                />
              </label>
              <label>
                {t("Forma rozmowy", "Interview format")}
                <select
                  name="interview_format"
                  defaultValue={c.interview_format ?? ""}
                >
                  <option value="">—</option>
                  <option value="phone">{t("Telefon", "Phone")}</option>
                  <option value="video">Video</option>
                  <option value="onsite">
                    {t("Stacjonarna", "In person")}
                  </option>
                </select>
              </label>
            </div>
            <div className="p01-checks">
              <label>
                <input
                  type="checkbox"
                  name="hr_support_required"
                  defaultChecked={c.hr_support_required}
                />
                {t("Potrzebne wsparcie HR", "HR support required")}
              </label>
              <label>
                <input
                  type="checkbox"
                  name="qualification_required"
                  defaultChecked={c.qualification_required}
                />
                {t(
                  "Weryfikacja kompetencji",
                  "Qualification confirmation required",
                )}
              </label>
              <label>
                <input
                  type="checkbox"
                  name="future_consent"
                  defaultChecked={c.future_consent}
                />
                {t(
                  "Zgoda na przyszłe rekrutacje",
                  "Consent for future recruitment",
                )}
              </label>
            </div>
            <label>
              {t("Źródło / dowód zgody", "Consent source / evidence")}
              <textarea
                name="consent_evidence"
                maxLength={2000}
                defaultValue={c.consent_evidence ?? ""}
              />
            </label>
            <label>
              {t("Przyczyna odrzucenia", "Rejection reason")}
              <textarea
                name="rejection_reason"
                maxLength={4000}
                defaultValue={c.rejection_reason ?? ""}
              />
            </label>
            <p className="muted-text">
              {t(
                "Status główny wynika ze statusu procesu. Ponowne otwarcie i rozszerzona mapa statusów wymagają potwierdzenia SEKA.",
                "Main state is derived from process status. Reopening and extended status mapping require SEKA confirmation.",
              )}
            </p>
            <button className="primary-button" disabled={!dirty || busy}>
              {busy
                ? t("Zapisywanie…", "Saving…")
                : t("Zapisz proces", "Save process")}
            </button>
          </fieldset>
        </form>
      )}
      {tab === "notes" && (
        <>
          <form
            className="p01-form"
            onChange={() => setDirty(true)}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              if (await send("notes", fields(f))) f.reset();
            }}
          >
            <fieldset disabled={busy || !allows("notes.create")}>
              <label>
                {t("Nowa notatka", "New note")}
                <textarea name="content" required maxLength={10000} />
              </label>
              <button className="primary-button">
                {t("Dodaj notatkę", "Add note")}
              </button>
            </fieldset>
          </form>
          {c.hr_notes && (
            <article className="p01-timeline-entry">
              <small>
                {t("Notatka z wcześniejszej wersji", "Legacy note")}
              </small>
              <p>{c.hr_notes}</p>
            </article>
          )}
          {data.notes.map((n) => (
            <article className="p01-timeline-entry" key={n.id}>
              <small>
                {n.actor_label} · {date(n.created_at)} ·{" "}
                {labels[n.process_status] ?? n.process_status}
              </small>
              <p>{n.content}</p>
            </article>
          ))}
          {!data.notes.length && (
            <p className="empty-state">
              {t("Brak nowych notatek.", "No new notes yet.")}
            </p>
          )}
        </>
      )}
      {tab === "contacts" && (
        <>
          <form
            className="p01-form"
            onChange={() => setDirty(true)}
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget,
                d = fields(f);
              if (
                await send("contacts", {
                  ...d,
                  phone_outcome: d.phone_outcome || null,
                  purpose_code: d.purpose_code || null,
                  occurred_at: new Date(d.occurred_at).toISOString(),
                })
              )
                f.reset();
            }}
          >
            <fieldset disabled={busy || !allows("contacts.create")}>
              <div className="p01-fields">
                <label>
                  {t("Zdarzenie", "Event")}
                  <select name="event_code">
                    {meta.dictionaries
                      .filter(
                        (d) =>
                          d.kind === "event" &&
                          d.is_active &&
                          !d.code.startsWith("email_"),
                      )
                      .map((d) => (
                        <option key={d.code} value={d.code}>
                          {pl ? d.label_pl : d.label_en}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {t("Cel", "Purpose")}
                  <select name="purpose_code">
                    <option value="">
                      {t("Do uzupełnienia", "Not specified")}
                    </option>
                    {meta.dictionaries
                      .filter((d) => d.kind === "purpose" && d.is_active)
                      .map((d) => (
                        <option key={d.code} value={d.code}>
                          {pl ? d.label_pl : d.label_en}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {t("Data zdarzenia", "Event date")}
                  <input name="occurred_at" type="datetime-local" required />
                </label>
                <label>
                  {t("Wynik telefonu", "Phone outcome")}
                  <select name="phone_outcome">
                    <option value="">—</option>
                    <option value="answered">
                      {t("Odebrał/a", "Answered")}
                    </option>
                    <option value="not_answered">
                      {t("Nie odebrał/a", "Not answered")}
                    </option>
                  </select>
                </label>
              </div>
              <label>
                {t("Opis / odpowiedź", "Details / response")}
                <textarea name="content" maxLength={10000} />
              </label>
              <button className="primary-button">
                {t("Zapisz zdarzenie", "Record event")}
              </button>
            </fieldset>
          </form>
          {data.contacts.map((n) => (
            <article className="p01-timeline-entry" key={n.id}>
              <strong>{dictionary(n.event_code)}</strong>
              <small>
                {date(n.occurred_at)} · {n.actor_label} ·{" "}
                {labels[n.process_status] ?? n.process_status}
              </small>
              <p>
                {dictionary(n.purpose_code)}
                {n.phone_outcome
                  ? ` · ${n.phone_outcome === "answered" ? t("Odebrał/a", "Answered") : t("Nie odebrał/a", "Not answered")}`
                  : ""}
              </p>
              {n.content && <p>{n.content}</p>}
              {n.message_id && (
                <a
                  href={`/candidates/${candidateId}?tab=correspondence`}
                  className="text-action"
                >
                  {t("Otwórz korespondencję", "Open conversation")} ↗
                </a>
              )}
              {allows("contacts.create") && (
                <form
                  className="p01-form"
                  onChange={() => setDirty(true)}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const d = fields(e.currentTarget);
                    await send(
                      `contacts/${n.id}`,
                      { purpose_code: d.purpose_code || null },
                      "PATCH",
                    );
                  }}
                >
                  <label>
                    {t("Uzupełnij cel kontaktu", "Update contact purpose")}
                    <select
                      name="purpose_code"
                      defaultValue={n.purpose_code ?? ""}
                    >
                      <option value="">—</option>
                      {meta.dictionaries
                        .filter((d) => d.kind === "purpose" && d.is_active)
                        .map((d) => (
                          <option key={d.code} value={d.code}>
                            {pl ? d.label_pl : d.label_en}
                          </option>
                        ))}
                    </select>
                  </label>
                  <button className="secondary-button" disabled={busy}>
                    {t("Zapisz cel", "Save purpose")}
                  </button>
                </form>
              )}
            </article>
          ))}
        </>
      )}
      {tab === "reviews" && (
        <>
          <p className="p01-policy-note">
            {t(
              "Opinia nie zmienia decyzji dyrektora oddziału. Potwierdzenie kompetencji jest osobnym etapem.",
              "An opinion does not change the unit director’s decision. Qualification confirmation is a separate stage.",
            )}
          </p>
          {allows("qualification.request") && (
            <form
              className="p01-form"
              onChange={() => setDirty(true)}
              onSubmit={async (e) => {
                e.preventDefault();
                await send("reviews", fields(e.currentTarget));
              }}
            >
              <fieldset disabled={busy}>
                <div className="p01-fields">
                  <label>
                    {t("Dyrektor Nadzoru/OŚ", "Qualification director")}
                    <select required name="reviewer_id">
                      <option value="">—</option>
                      {meta.employees
                        .filter((e) => e.role_code === "specialist_director")
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    {t("Etap", "Stage")}
                    <select name="stage">
                      <option value="opinion">
                        {t("Wstępna opinia", "Initial opinion")}
                      </option>
                      <option value="confirmation">
                        {t(
                          "Potwierdzenie kompetencji",
                          "Qualification confirmation",
                        )}
                      </option>
                    </select>
                  </label>
                </div>
                <button className="primary-button">
                  {t("Poproś o ocenę", "Request review")}
                </button>
              </fieldset>
            </form>
          )}
          {data.reviews.map((n) => (
            <article key={n.id} className="p01-timeline-entry">
              <strong>
                {n.stage === "opinion"
                  ? t("Opinia", "Opinion")
                  : t("Potwierdzenie", "Confirmation")}{" "}
                · {n.decision}
              </strong>
              <small>
                {meta.employees.find((e) => e.id === n.reviewer_id)?.name} ·{" "}
                {date(n.created_at)}
              </small>
              {n.opinion && <p>{n.opinion}</p>}
              {n.decision === "pending" &&
                n.reviewer_id === context.employee?.id &&
                allows("qualification.decide") && (
                  <form
                    className="p01-form"
                    onChange={() => setDirty(true)}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const d = fields(e.currentTarget);
                      await send(
                        `reviews/${n.id}`,
                        { ...d, version: n.version },
                        "PATCH",
                      );
                    }}
                  >
                    <fieldset disabled={busy}>
                      <label>
                        {t("Opinia i uzasadnienie", "Opinion and explanation")}
                        <textarea required name="opinion" maxLength={10000} />
                      </label>
                      <label>
                        {t("Ocena", "Assessment")}
                        <select name="decision">
                          {n.stage === "opinion" ? (
                            <option value="opinion">
                              {t("Zapisz opinię", "Record opinion")}
                            </option>
                          ) : (
                            <>
                              <option value="accepted">
                                {t("Akceptacja", "Accepted")}
                              </option>
                              <option value="rejected">
                                {t("Odrzucenie", "Rejected")}
                              </option>
                            </>
                          )}
                        </select>
                      </label>
                      <button className="primary-button">
                        {t("Zatwierdź ocenę", "Submit assessment")}
                      </button>
                    </fieldset>
                  </form>
                )}
            </article>
          ))}
        </>
      )}
      {tab === "access" && canGrant && (
        <>
          <p className="p01-policy-note">
            {t(
              "Proponowany mechanizm: koordynator HR nadaje dostęp do konkretnej aplikacji. Polityka wymaga akceptacji SEKA przed produkcją. Role są przypisywane w Azure.",
              "Proposed mechanism: HR coordinator grants access to one application. SEKA must approve this policy before production. Roles are assigned in Azure.",
            )}
          </p>
          <form
            className="p01-form"
            onChange={() => setDirty(true)}
            onSubmit={async (e) => {
              e.preventDefault();
              const d = fields(e.currentTarget);
              await send("grants", {
                employee_id: d.employee_id,
                expires_at: d.expires_at
                  ? new Date(d.expires_at).toISOString()
                  : null,
              });
            }}
          >
            <fieldset disabled={busy}>
              <div className="p01-fields">
                <label>
                  {t("Pracownik", "Employee")}
                  <select required name="employee_id">
                    <option value="">—</option>
                    {meta.employees
                      .filter((e) =>
                        ["deputy_director", "hr_support"].includes(e.role_code),
                      )
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {t("Ważny do (opcjonalnie)", "Expires (optional)")}
                  <input name="expires_at" type="datetime-local" />
                </label>
              </div>
              <button className="primary-button">
                {t("Nadaj dostęp", "Grant access")}
              </button>
            </fieldset>
          </form>
          {data.grants.map((n) => (
            <article key={n.id} className="p01-timeline-entry">
              <strong>
                {meta.employees.find((e) => e.id === n.employee_id)?.name ??
                  n.employee_id}
              </strong>
              <small>
                {t("Ważny do", "Expires")}: {date(n.expires_at)}
              </small>
              <button
                type="button"
                className="text-action"
                disabled={busy}
                onClick={() => {
                  if (confirm(t("Odebrać dostęp?", "Revoke access?")))
                    void send(`grants/${n.id}`, {}, "DELETE");
                }}
              >
                {t("Odbierz dostęp", "Revoke access")}
              </button>
            </article>
          ))}
        </>
      )}
      {data.paging?.[tab === "access" ? "grants" : tab] && (
        <div className="history-pagination">
          <button
            className="secondary-button"
            type="button"
            disabled={page === 1}
            onClick={() => {
              if (
                !dirty ||
                confirm(
                  t(
                    "Opuścić bez zapisania zmian?",
                    "Leave without saving changes?",
                  ),
                )
              ) {
                setDirty(false);
                setPage((v) => v - 1);
              }
            }}
          >
            ←
          </button>
          <span>
            {page} / {data.paging[tab === "access" ? "grants" : tab].last_page}
          </span>
          <button
            className="secondary-button"
            type="button"
            disabled={
              page >= data.paging[tab === "access" ? "grants" : tab].last_page
            }
            onClick={() => {
              if (
                !dirty ||
                confirm(
                  t(
                    "Opuścić bez zapisania zmian?",
                    "Leave without saving changes?",
                  ),
                )
              ) {
                setDirty(false);
                setPage((v) => v + 1);
              }
            }}
          >
            →
          </button>
        </div>
      )}
    </section>
  );
}
