"use client";
import { useEffect, useState } from "react";
import { API_URL, apiGet } from "@/lib/api";
export default function ApplicationAttachments({
  id,
  language,
  canUpload,
}: {
  id: string;
  language: "pl" | "en";
  canUpload: boolean;
}) {
  const [items, setItems] = useState<
      { id: number; filename: string; size: number }[]
    >([]),
    [reload, setReload] = useState(0),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  const pl = language === "pl";
  useEffect(() => {
    const c = new AbortController();
    apiGet<{ attachments: typeof items }>(`/p01/applications/${id}`, c.signal)
      .then((d) => {
        if (!c.signal.aborted) setItems(d.attachments ?? []);
      })
      .catch(() => {
        if (!c.signal.aborted) setError(true);
      });
    return () => c.abort();
  }, [id, reload]);
  return (
    <section className="p01-attachments">
      <h3>{pl ? "Załączniki aplikacji" : "Application attachments"}</h3>
      {items.map((a) => (
        <a
          key={a.id}
          href={`${API_URL}/p01/attachments/${a.id}`}
          target="_blank"
          rel="noreferrer"
          className="attachment-row"
        >
          <span>↗ {a.filename}</span>
          <small>{Math.ceil(a.size / 1024)} KB</small>
        </a>
      ))}
      {!items.length && (
        <p className="muted-text">
          {pl ? "Brak dodatkowych załączników." : "No additional attachments."}
        </p>
      )}
      {error && (
        <p className="error">
          {pl
            ? "Nie udało się pobrać lub zapisać załącznika."
            : "Could not load or save attachment."}
        </p>
      )}
      {canUpload && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = e.currentTarget;
            if (busy) return;
            setBusy(true);
            setError(false);
            try {
              const r = await fetch(
                `${API_URL}/p01/applications/${id}/attachments`,
                {
                  method: "POST",
                  credentials: "include",
                  body: new FormData(f),
                },
              );
              if (!r.ok) throw Error();
              f.reset();
              setReload((v) => v + 1);
            } catch {
              setError(true);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {pl
              ? "Dodaj PDF, JPG lub PNG · maks. 5 MB"
              : "Add PDF, JPG or PNG · max. 5 MB"}
            <input
              type="file"
              name="file"
              accept=".pdf,.jpg,.jpeg,.png"
              required
              disabled={busy}
            />
          </label>
          <button className="secondary-button" disabled={busy}>
            {pl ? "Dodaj załącznik" : "Add attachment"}
          </button>
        </form>
      )}
    </section>
  );
}
