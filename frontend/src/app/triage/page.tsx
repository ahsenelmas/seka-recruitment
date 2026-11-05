"use client";
import { useEffect, useState } from "react";
import { API_URL, apiGet, Branch } from "@/lib/api";
import { useLanguage } from "@/lib/useLanguage";
import WorkspaceNavigation from "@/components/WorkspaceNavigation";
type Envelope = {
  id: number;
  sender: string;
  subject: string;
  body: string;
  classification: string;
  created_at: string;
};
type Detail = {
  envelope: Envelope;
  attachments: { id: number; filename: string; size: number }[];
};
export default function Triage() {
  const [language, changeLanguage] = useLanguage(),
    pl = language === "pl";
  const [data, setData] = useState<{
      data: Envelope[];
      last_page: number;
    } | null>(null),
    [detail, setDetail] = useState<Detail | null>(null),
    [branches, setBranches] = useState<Branch[]>([]),
    [selected, setSelected] = useState<number | null>(null),
    [reload, setReload] = useState(0),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    setError("");
    Promise.all([
      apiGet<{ data: Envelope[]; last_page: number }>(
        `/p01/intake?page=${page}`,
        c.signal,
      ),
      apiGet<Branch[]>("/branches", c.signal),
    ])
      .then(([d, b]) => {
        if (!c.signal.aborted) {
          setData(d);
          setBranches(b);
        }
      })
      .catch(() => {
        if (!c.signal.aborted)
          setError(
            pl
              ? "Brak dostępu lub połączenia."
              : "Access denied or connection failed.",
          );
      });
    return () => c.abort();
  }, [reload, page, pl]);
  useEffect(() => {
    if (!selected) {
      setDetail(null);
      return;
    }
    const c = new AbortController();
    setDetail(null);
    apiGet<Detail>(`/p01/intake/${selected}`, c.signal)
      .then((d) => {
        if (!c.signal.aborted) setDetail(d);
      })
      .catch(() => {
        if (!c.signal.aborted)
          setError(
            pl ? "Nie udało się pobrać wiadomości." : "Could not load message.",
          );
      });
    return () => c.abort();
  }, [selected, pl]);
  async function action(path: string, body: object, method = "POST") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${API_URL}/p01/intake/${selected}${path}`, {
        method,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.message);
      setDirty(false);
      setSelected(null);
      setReload((v) => v + 1);
      if (d.id && path === "/accept")
        window.location.assign(`/candidates/${d.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="workspace dashboard-workspace">
      <WorkspaceNavigation
        section="queue"
        language={language}
        changeLanguage={changeLanguage}
        canEdit={false}
      />
      <section className="page-heading">
        <div>
          <p className="eyebrow">SEKA / INTAKE WORKSPACE</p>
          <h1>
            {pl
              ? "Każda wiadomość ma swój kolejny krok."
              : "Every message has a next step."}
          </h1>
          <p>
            {pl
              ? "Kolejka weryfikacji przed utworzeniem aplikacji. Automatyczna klasyfikacja AI czeka na wybór dostawcy."
              : "Review queue before an application is created. Automatic AI classification awaits provider approval."}
          </p>
        </div>
        <a className="primary-button" href="/manual">
          {pl ? "+ Wprowadź ręcznie" : "+ Add manually"}
        </a>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="p01-split">
        <aside>
          {data?.data.map((e) => (
            <button
              key={e.id}
              className={`p01-queue-row ${selected === e.id ? "selected" : ""}`}
              onClick={() => {
                if (
                  dirty &&
                  !confirm(
                    pl
                      ? "Opuścić bez zapisania zmian?"
                      : "Leave without saving changes?",
                  )
                )
                  return;
                setDirty(false);
                setSelected(e.id);
              }}
            >
              <small>
                {e.sender} ·{" "}
                {e.classification === "spam"
                  ? pl
                    ? "Spam / do decyzji"
                    : "Spam / pending decision"
                  : pl
                    ? "Do weryfikacji"
                    : "Needs review"}
              </small>
              <strong>{e.subject}</strong>
              <small>
                {new Date(e.created_at).toLocaleDateString(language)}
              </small>
            </button>
          ))}
          {data && !data.data.length && (
            <p className="empty-state">
              {pl ? "Kolejka jest pusta." : "The intake queue is clear."}
            </p>
          )}
          <div className="history-pagination">
            <button
              className="secondary-button"
              disabled={page === 1}
              onClick={() => setPage((v) => v - 1)}
            >
              ←
            </button>
            <span>
              {page} / {data?.last_page ?? 1}
            </span>
            <button
              className="secondary-button"
              disabled={!data || page >= data.last_page}
              onClick={() => setPage((v) => v + 1)}
            >
              →
            </button>
          </div>
        </aside>
        <section className="panel profile-card">
          {detail ? (
            <>
              <p className="eyebrow">{detail.envelope.sender}</p>
              <h2>{detail.envelope.subject}</h2>
              <div className="p01-email-body">{detail.envelope.body}</div>
              {detail.attachments.map((a) => (
                <a
                  className="attachment-row"
                  key={a.id}
                  href={`${API_URL}/p01/attachments/${a.id}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {a.filename}
                  <small>{Math.ceil(a.size / 1024)} KB</small>
                </a>
              ))}
              <form
                className="p01-form"
                onChange={() => setDirty(true)}
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = Object.fromEntries(new FormData(e.currentTarget));
                  void action("/accept", {
                    ...d,
                    branch_id: d.branch_id ? Number(d.branch_id) : null,
                    reply_to_application: d.reply_to_application || null,
                  });
                }}
              >
                <fieldset disabled={busy}>
                  <div className="p01-fields">
                    <label>
                      {pl ? "Imię" : "First name"}
                      <input required name="first_name" maxLength={100} />
                    </label>
                    <label>
                      {pl ? "Nazwisko" : "Last name"}
                      <input required name="last_name" maxLength={100} />
                    </label>
                    <label>
                      {pl ? "Oddział / dział" : "Branch / department"}
                      <select name="branch_id">
                        <option value="">—</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.city}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {pl ? "Stanowisko (opis)" : "Position (free text)"}
                      <input name="position" maxLength={150} />
                    </label>
                  </div>
                  <label>
                    {pl
                      ? "ID aplikacji, jeśli to odpowiedź (opcjonalne)"
                      : "Application ID if this is a reply (optional)"}
                    <input name="reply_to_application" placeholder="UUID" />
                  </label>
                  <p className="muted-text">
                    {pl
                      ? "Pozostaw puste dla nowej, niezależnej aplikacji. Dla odpowiedzi nadawca musi odpowiadać adresowi aplikacji."
                      : "Leave empty for a new independent application. A reply must match the application’s sender address."}
                  </p>
                  <button className="primary-button">
                    {pl
                      ? "Zapisz jako aplikację / odpowiedź"
                      : "Accept as application / reply"}
                  </button>
                </fieldset>
              </form>
              <div className="header-actions">
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() =>
                    void action(
                      "",
                      {
                        classification:
                          detail.envelope.classification === "spam"
                            ? "pending"
                            : "spam",
                      },
                      "PATCH",
                    )
                  }
                >
                  {detail.envelope.classification === "spam"
                    ? pl
                      ? "Przywróć do weryfikacji"
                      : "Restore for review"
                    : pl
                      ? "Oznacz jako spam"
                      : "Mark as spam"}
                </button>
                <button
                  className="text-action"
                  disabled={busy}
                  onClick={() => {
                    if (
                      confirm(
                        pl
                          ? "Trwale usunąć tę nieprzyjętą wiadomość i załączniki?"
                          : "Permanently delete this unaccepted message and attachments?",
                      )
                    )
                      void action("", {}, "DELETE");
                  }}
                >
                  {pl ? "Usuń wiadomość" : "Delete message"}
                </button>
              </div>
            </>
          ) : (
            <div className="p01-empty-art">
              <h2>{pl ? "Zacznij od wiadomości." : "Start with a message."}</h2>
              <p>
                {pl
                  ? "Wybierz wiadomość po lewej. Żadna pozycja w tej kolejce nie jest jeszcze aplikacją."
                  : "Select a message on the left. Items here are not application records yet."}
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
