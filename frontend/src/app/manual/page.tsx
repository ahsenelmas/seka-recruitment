"use client";
import { useEffect, useState } from "react";
import { API_URL, apiGet, Branch } from "@/lib/api";
import { useLanguage } from "@/lib/useLanguage";
import WorkspaceNavigation from "@/components/WorkspaceNavigation";
export default function Manual() {
  const [language, changeLanguage] = useLanguage(),
    pl = language === "pl";
  const [branches, setBranches] = useState<Branch[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const c = new AbortController();
    apiGet<Branch[]>("/branches", c.signal)
      .then(setBranches)
      .catch(() => {
        if (!c.signal.aborted)
          setError(
            pl
              ? "Nie udało się pobrać jednostek."
              : "Could not load organisational units.",
          );
      });
    return () => c.abort();
  }, [pl]);
  return (
    <main className="workspace dashboard-workspace">
      <WorkspaceNavigation
        section="intake"
        language={language}
        changeLanguage={changeLanguage}
        canEdit={true}
      />
      <section className="page-heading">
        <div>
          <p className="eyebrow">SEKA / MANUAL INTAKE</p>
          <h1>
            {pl
              ? "Nowa, niezależna aplikacja."
              : "A new, independent application."}
          </h1>
          <p>
            {pl
              ? "Wprowadzanie wewnętrzne. Dokumenty można dodać po zapisaniu aplikacji."
              : "Internal entry. Documents can be added after the application is saved."}
          </p>
        </div>
      </section>
      <section className="panel profile-card">
        <form
          className="p01-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const d = Object.fromEntries(new FormData(e.currentTarget));
            setBusy(true);
            setError("");
            try {
              const r = await fetch(`${API_URL}/p01/manual`, {
                method: "POST",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                  Accept: "application/json",
                },
                body: JSON.stringify({
                  ...d,
                  branch_id: d.branch_id ? Number(d.branch_id) : null,
                }),
              });
              const c = await r.json();
              if (!r.ok) throw Error(c.message);
              window.location.assign(`/candidates/${c.id}`);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Error");
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <div className="p01-fields">
              <label>
                {pl ? "Imię" : "First name"}
                <input name="first_name" required maxLength={100} />
              </label>
              <label>
                {pl ? "Nazwisko" : "Last name"}
                <input name="last_name" required maxLength={100} />
              </label>
              <label>
                E-mail
                <input name="email" type="email" required maxLength={254} />
              </label>
              <label>
                {pl ? "Stanowisko (opis)" : "Position (free text)"}
                <input name="position" maxLength={150} />
              </label>
              <label>
                {pl ? "Oddział / dział" : "Branch / department"}
                <select name="branch_id">
                  <option value="">—</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.city}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary-button">
              {pl ? "Utwórz aplikację" : "Create application"}
            </button>
          </fieldset>
        </form>
      </section>
    </main>
  );
}
