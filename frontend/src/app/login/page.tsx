"use client";
import { useEffect, useState } from "react";
import { API_URL, apiGet, DemoCatalog, DemoContext } from "@/lib/api";
import { useLanguage } from "@/lib/useLanguage";
export default function LoginPage() {
  const [language, changeLanguage] = useLanguage();
  const pl = language === "pl",
    t = (a: string, b: string) => (pl ? a : b);
  const [mode, setMode] = useState<string | null>(null),
    [catalog, setCatalog] = useState<DemoCatalog | null>(null),
    [selected, setSelected] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    document.title = pl ? "SEKA — Rekrutacja" : "SEKA — Recruitment";
    document.documentElement.lang = language;
  }, [pl, language]);
  useEffect(() => {
    const c = new AbortController();
    setError(false);
    setMode(null);
    (async () => {
      try {
        const config = await apiGet<{ mode: string; demo_allowed: boolean }>(
          "/auth/config",
          c.signal,
        );
        if (c.signal.aborted) return;
        setMode(config.mode);
        if (config.mode === "entra") {
          if (
            new URLSearchParams(window.location.search).get("authenticated") ===
            "1"
          ) {
            const context = await apiGet<DemoContext>(
              "/demo/context",
              c.signal,
            );
            sessionStorage.setItem("seka-demo-entered", "yes");
            window.location.replace(
              context.permissions.includes("system.configure")
                ? "/system/settings"
                : "/",
            );
          }
          return;
        }
        if (!config.demo_allowed) throw Error();
        const data = await apiGet<DemoCatalog>("/demo/catalog", c.signal);
        if (!c.signal.aborted) {
          setCatalog(data);
          setSelected(
            data.employees.find((e) => e.role_code === "hr_manager")?.id ??
              data.employees[0]?.id ??
              "",
          );
        }
      } catch {
        if (!c.signal.aborted) setError(true);
      }
    })();
    return () => c.abort();
  }, [retry]);
  const employee = catalog?.employees.find((e) => e.id === selected),
    role = catalog?.roles.find((r) => r.code === employee?.role_code);
  async function enter(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !employee) return;
    setBusy(true);
    setError(false);
    try {
      const r = await fetch(`${API_URL}/demo/employee`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id: selected }),
      });
      if (!r.ok) throw Error();
      sessionStorage.setItem("seka-demo-entered", "yes");
      window.location.assign(
        role?.permissions.includes("system.configure")
          ? "/system/settings"
          : "/",
      );
    } catch {
      setBusy(false);
      setError(true);
    }
  }
  return (
    <main className="access-page">
      <header className="access-topbar">
        <a className="access-wordmark" href="/login">
          SEKA<span>RECRUITMENT OPERATIONS</span>
        </a>
        <div className="language-switch" role="group" aria-label="Language">
          <button
            type="button"
            onClick={() => changeLanguage("pl")}
            className={pl ? "active" : ""}
          >
            PL
          </button>
          <button
            type="button"
            onClick={() => changeLanguage("en")}
            className={!pl ? "active" : ""}
          >
            EN
          </button>
        </div>
      </header>
      <div className="login-layout">
        <section className="login-story">
          <p className="eyebrow">
            SEKA / {t("SYSTEM REKRUTACYJNY", "RECRUITMENT SYSTEM")}
          </p>
          <h1>
            {t("Rekrutacja.", "Recruitment.")}
            <br />
            <em>{t("W jednym miejscu.", "In one place.")}</em>
          </h1>
          <p>
            {t(
              "Zgłoszenia, korespondencja i współpraca zespołu. Jeden proces od pierwszej wiadomości do decyzji.",
              "Applications, correspondence and team collaboration. One process from the first message to the final decision.",
            )}
          </p>
          <div className="login-process-art" aria-hidden="true">
            <div className="process-art-line" />
            <div>
              <span>01</span>
              <strong>{t("Przyjęcie aplikacji", "Application intake")}</strong>
              <small>{t("E-mail i dokumenty", "Email & documents")}</small>
            </div>
            <div>
              <span>02</span>
              <strong>
                {t("Weryfikacja i rozmowy", "Review & interviews")}
              </strong>
              <small>{t("Współpraca zespołu", "Team collaboration")}</small>
            </div>
            <div>
              <span>03</span>
              <strong>
                {t("Decyzja i zakończenie", "Decision & completion")}
              </strong>
              <small>{t("Udokumentowany proces", "Documented process")}</small>
            </div>
          </div>
          <p className="login-footnote">
            SEKA S.A. <span> / </span>{" "}
            {t("Panel pracownika", "Employee workspace")}
          </p>
        </section>
        <section className="login-form-side">
          <div className="access-panel">
            <span className="login-mode-badge">
              {mode === "entra"
                ? "MICROSOFT ENTRA ID"
                : t("DOSTĘP DO PRZESTRZENI ROBOCZEJ", "WORKSPACE ACCESS")}
            </span>
            <div className="access-heading">
              <h2>{t("Witaj w SEKA", "Welcome to SEKA")}</h2>
              <h1>{t("Zaloguj się do panelu", "Access your workspace")}</h1>
              <p>
                {mode === "entra"
                  ? t(
                      "Zaloguj się kontem firmowym. Role i uprawnienia organizacyjne pochodzą z Azure.",
                      "Sign in with your company account. Business roles and organisational access come from Azure.",
                    )
                  : t(
                      "Wybierz konto i przejdź do swojego obszaru pracy.",
                      "Select an account to open your assigned workspace.",
                    )}
              </p>
            </div>
            {mode === "entra" ? (
              <a
                className="primary-button microsoft-login"
                href={`${API_URL}/auth/entra/start`}
              >
                {t("Zaloguj przez Microsoft", "Continue with Microsoft")} ↗
              </a>
            ) : (
              <form onSubmit={enter}>
                <fieldset disabled={busy || !catalog}>
                  <label>
                    {t("Konto pracownika", "Employee account")}
                    <select
                      required
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      <option value="">
                        {t("Wybierz konto", "Choose account")}
                      </option>
                      {catalog?.employees.map((e) => (
                        <option value={e.id} key={e.id}>
                          {e.name.replace(/^Demo\s*/i, "")}
                        </option>
                      ))}
                    </select>
                  </label>
                  {employee && role && (
                    <dl className="access-account-details">
                      <div>
                        <dt>{t("Rola", "Role")}</dt>
                        <dd>{pl ? role.label_pl : role.label_en}</dd>
                      </div>
                      <div>
                        <dt>{t("Zakres", "Scope")}</dt>
                        <dd>
                          {role.scope === "all"
                            ? t("Cała firma", "Company-wide")
                            : role.scope === "assigned"
                              ? t(
                                  "Wyłącznie udostępnione aplikacje",
                                  "Explicitly shared applications",
                                )
                              : catalog?.branches.find(
                                  (b) => b.id === employee.branch_id,
                                )?.city}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("Konto", "Account")}</dt>
                        <dd>{employee.email}</dd>
                      </div>
                    </dl>
                  )}
                  <button
                    className="primary-button access-submit"
                    disabled={busy || !employee}
                  >
                    {busy
                      ? t("Otwieranie…", "Opening…")
                      : t("Otwórz przestrzeń roboczą", "Open workspace")}
                    <span>↗</span>
                  </button>
                </fieldset>
              </form>
            )}
            {error && (
              <div role="alert" className="access-error">
                <p className="error">
                  {t(
                    "Nie udało się połączyć. Sprawdź API i konfigurację logowania.",
                    "Could not connect. Check the API and authentication configuration.",
                  )}
                </p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setRetry((v) => v + 1)}
                >
                  {t("Spróbuj ponownie", "Retry")}
                </button>
              </div>
            )}
            <div className="login-separator" />
            <p className="muted-text">
              {mode === "entra"
                ? t(
                    "Konta i role są zarządzane przez organizację. Dostęp do konkretnych aplikacji podlega odrębnej polityce.",
                    "Accounts and roles are managed by your organisation. Per-application access follows a separate policy.",
                  )
                : t(
                    "Dostęp podglądowy · wybór konta jest symulowany. Wyłącznie dane fikcyjne.",
                    "Preview access · account selection is simulated. Fictional data only.",
                  )}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
