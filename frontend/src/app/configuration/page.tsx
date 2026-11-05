"use client";
import { useEffect, useState } from "react";
import { API_URL, apiGet } from "@/lib/api";
import { useLanguage } from "@/lib/useLanguage";
import WorkspaceNavigation from "@/components/WorkspaceNavigation";
type Entry = {
  id: number;
  kind: string;
  code: string;
  label_pl: string;
  label_en: string;
  is_active: boolean;
};
type Unit = {
  id: number;
  code: string;
  name: string;
  city: string;
  unit_type: string;
};
export default function Configuration() {
  const [language, changeLanguage] = useLanguage(),
    pl = language === "pl";
  const [items, setItems] = useState<Entry[]>([]),
    [units, setUnits] = useState<Unit[]>([]),
    [reload, setReload] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    Promise.all([
      apiGet<Entry[]>("/p01/dictionaries", c.signal),
      apiGet<Unit[]>("/p01/units", c.signal),
    ])
      .then(([d, u]) => {
        if (!c.signal.aborted) {
          setItems(d);
          setUnits(u);
        }
      })
      .catch(() => {
        if (!c.signal.aborted)
          setError(
            pl
              ? "Dostęp wymaga administratora technicznego."
              : "Technical administrator access is required.",
          );
      });
    return () => c.abort();
  }, [reload, pl]);
  async function save(path: string, body: object, method = "POST") {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${API_URL}/p01/${path}`, {
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
      setReload((v) => v + 1);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="workspace dashboard-workspace">
      <WorkspaceNavigation
        section="configuration"
        language={language}
        changeLanguage={changeLanguage}
        canEdit={false}
      />
      <section className="page-heading">
        <div>
          <p className="eyebrow">SEKA / CONFIGURATION</p>
          <h1>
            {pl
              ? "Wspólny język procesu."
              : "A shared language for recruitment."}
          </h1>
          <p>
            {pl
              ? "Słowniki zdarzeń, celów i jednostek. Role pracowników są przypisywane w Azure."
              : "Event types, contact purposes and organisational units. Employee roles are assigned in Azure."}
          </p>
        </div>
        <a href="/admin/statuses" className="secondary-button">
          {pl ? "Statusy procesu" : "Process statuses"} ↗
        </a>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="p01-policy-note">
        {pl
          ? "Przypisanie zarządzania słownikami administratorowi technicznemu jest propozycją do potwierdzenia przez SEKA."
          : "Technical administrator ownership of dictionaries is a proposed policy requiring SEKA confirmation."}
      </p>
      <div className="p01-fields">
        <section className="panel profile-card">
          <h2>{pl ? "Zdarzenia i cele" : "Events & purposes"}</h2>
          <form
            className="p01-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              if (
                await save("dictionaries", Object.fromEntries(new FormData(f)))
              )
                f.reset();
            }}
          >
            <fieldset disabled={busy}>
              <div className="p01-fields">
                <label>
                  {pl ? "Rodzaj" : "Kind"}
                  <select name="kind">
                    <option value="event">{pl ? "Zdarzenie" : "Event"}</option>
                    <option value="purpose">
                      {pl ? "Cel kontaktu" : "Contact purpose"}
                    </option>
                  </select>
                </label>
                <label>
                  {pl ? "Kod" : "Code"}
                  <input
                    name="code"
                    pattern="[a-z][a-z0-9_]*"
                    maxLength={50}
                    required
                  />
                </label>
                <label>
                  Polski
                  <input name="label_pl" required maxLength={150} />
                </label>
                <label>
                  English
                  <input name="label_en" required maxLength={150} />
                </label>
              </div>
              <button className="primary-button">
                {pl ? "Dodaj pozycję" : "Add entry"}
              </button>
            </fieldset>
          </form>
          {items.map((d) => (
            <article className="p01-timeline-entry" key={d.id}>
              <strong>{pl ? d.label_pl : d.label_en}</strong>
              <small>
                {d.kind} / {d.code} ·{" "}
                {d.is_active
                  ? pl
                    ? "Aktywne"
                    : "Active"
                  : pl
                    ? "Archiwum"
                    : "Archived"}
              </small>
              {!["email_sent", "email_received"].includes(d.code) && (
                <button
                  className="text-action"
                  disabled={busy}
                  onClick={() =>
                    void save(
                      `dictionaries/${d.id}`,
                      { is_active: !d.is_active },
                      "PATCH",
                    )
                  }
                >
                  {d.is_active
                    ? pl
                      ? "Archiwizuj"
                      : "Archive"
                    : pl
                      ? "Przywróć"
                      : "Restore"}
                </button>
              )}
            </article>
          ))}
        </section>
        <section className="panel profile-card">
          <h2>{pl ? "Oddziały i działy" : "Branches & departments"}</h2>
          <form
            className="p01-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = e.currentTarget;
              if (await save("units", Object.fromEntries(new FormData(f))))
                f.reset();
            }}
          >
            <fieldset disabled={busy}>
              <label>
                {pl
                  ? "Stały kod jednostki (Azure)"
                  : "Stable unit code (Azure)"}
                <input
                  name="code"
                  required
                  pattern="[a-z0-9][a-z0-9_-]*"
                  maxLength={80}
                />
              </label>
              <label>
                {pl ? "Nazwa" : "Name"}
                <input name="name" required maxLength={150} />
              </label>
              <div className="p01-fields">
                <label>
                  {pl ? "Miasto" : "City"}
                  <input name="city" required maxLength={100} />
                </label>
                <label>
                  {pl ? "Typ" : "Type"}
                  <select name="unit_type">
                    <option value="branch">{pl ? "Oddział" : "Branch"}</option>
                    <option value="department">
                      {pl ? "Dział" : "Department"}
                    </option>
                  </select>
                </label>
              </div>
              <button className="primary-button">
                {pl ? "Dodaj jednostkę" : "Add unit"}
              </button>
            </fieldset>
          </form>
          {units.map((u) => (
            <article key={u.id} className="p01-timeline-entry">
              <strong>{u.name}</strong>
              <small>
                {u.city} · {u.unit_type} · {u.code}
              </small>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
