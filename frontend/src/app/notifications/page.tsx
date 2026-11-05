"use client";
import { useEffect, useState } from "react";
import { API_URL, apiGet } from "@/lib/api";
import { useLanguage } from "@/lib/useLanguage";
import WorkspaceNavigation from "@/components/WorkspaceNavigation";
type Notice = {
  id: number;
  candidate_id: string;
  kind: string;
  created_at: string;
  read_at: string | null;
};
export default function Notifications() {
  const [language, changeLanguage] = useLanguage(),
    pl = language === "pl";
  const [data, setData] = useState<{
      data: Notice[];
      current_page: number;
      last_page: number;
    } | null>(null),
    [page, setPage] = useState(1),
    [reload, setReload] = useState(0),
    [error, setError] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    setError(false);
    apiGet<typeof data>(`/p01/notifications?page=${page}`, c.signal)
      .then((d) => {
        if (!c.signal.aborted) setData(d);
      })
      .catch(() => {
        if (!c.signal.aborted) setError(true);
      });
    return () => c.abort();
  }, [page, reload]);
  const names: Record<string, string> = {
    new_message: pl ? "Nowa wiadomość" : "New message",
    owner_assigned: pl ? "Przypisano opiekuna" : "Owner assigned",
    qualification_requested: pl
      ? "Prośba o ocenę kompetencji"
      : "Qualification review requested",
    qualification_decided: pl
      ? "Ocena kompetencji gotowa"
      : "Qualification assessment recorded",
  };
  return (
    <main className="workspace dashboard-workspace">
      <WorkspaceNavigation
        section="notifications"
        language={language}
        changeLanguage={changeLanguage}
        canEdit={false}
      />
      <section className="page-heading">
        <div>
          <p className="eyebrow">SEKA / TEAM UPDATES</p>
          <h1>{pl ? "Pozostań na bieżąco." : "Keep the team in the loop."}</h1>
          <p>
            {pl
              ? "Powiadomienia wewnętrzne dla wybranego pracownika. E-mail i Teams nie są połączone."
              : "In-app updates for the signed-in employee. Email and Teams notifications are not connected."}
          </p>
        </div>
        <button
          className="secondary-button"
          onClick={() => setReload((v) => v + 1)}
        >
          {pl ? "Odśwież" : "Refresh"}
        </button>
      </section>
      {error ? (
        <p role="alert" className="error">
          {pl
            ? "Wybierz konto pracownika i sprawdź połączenie."
            : "Choose an employee account and check the connection."}
        </p>
      ) : !data ? (
        <p className="empty-state">…</p>
      ) : (
        <>
          <div className="panel profile-card">
            {!data.data.length && (
              <div className="p01-empty-art">
                <h2>{pl ? "Wszystko na bieżąco" : "You’re all caught up"}</h2>
                <p>
                  {pl
                    ? "Nowe wiadomości, przypisania i oceny pojawią się tutaj."
                    : "New messages, assignments and assessments will appear here."}
                </p>
              </div>
            )}
            {data.data.map((n) => (
              <article className="p01-timeline-entry" key={n.id}>
                <small>
                  {new Date(n.created_at).toLocaleString(language)} ·{" "}
                  {n.read_at
                    ? pl
                      ? "Przeczytano"
                      : "Read"
                    : pl
                      ? "Nowe"
                      : "New"}
                </small>
                <h3>{names[n.kind] ?? n.kind}</h3>
                <a
                  className="text-action"
                  href={`/candidates/${n.candidate_id}`}
                >
                  {pl ? "Otwórz aplikację" : "Open application"} ↗
                </a>
                {!n.read_at && (
                  <button
                    className="secondary-button"
                    onClick={async () => {
                      const r = await fetch(
                        `${API_URL}/p01/notifications/${n.id}`,
                        { method: "PATCH", credentials: "include" },
                      );
                      if (r.ok) setReload((v) => v + 1);
                      else setError(true);
                    }}
                  >
                    {pl ? "Oznacz przeczytane" : "Mark read"}
                  </button>
                )}
              </article>
            ))}
          </div>
          <div className="history-pagination">
            <button
              className="secondary-button"
              disabled={page === 1}
              onClick={() => setPage((v) => v - 1)}
            >
              ←
            </button>
            <span>
              {page} / {data.last_page}
            </span>
            <button
              className="secondary-button"
              disabled={page === data.last_page}
              onClick={() => setPage((v) => v + 1)}
            >
              →
            </button>
          </div>
        </>
      )}
    </main>
  );
}
