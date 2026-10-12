"use client";

import { useEffect, useState } from "react";
import {
  apiGet,
  Branch,
  CandidatePage,
  CandidateStatus,
  Dashboard,
  STATUS_LABELS,
} from "@/lib/api";

type Language = "pl" | "en";

const TEXT = {
  pl: {
    recruitment: "Rekrutacja",
    demo: "Wersja demonstracyjna",
    title: "Przegląd rekrutacji",
    subtitle: "Zarządzaj aplikacjami i kandydatami w oddziałach.",
    refresh: "Odśwież dane",
    notice: "Dane demonstracyjne — kandydaci i oddziały są przykładowe.",
    total: "Wszystkie aplikacje",
    new: "Nowe aplikacje",
    review: "W trakcie analizy",
    interview: "Rozmowy",
    hired: "Zatrudnieni",
    rejected: "Odrzucone",
    candidates: "Kandydaci",
    searchHelp: "Wyszukuj według nazwiska, adresu e-mail lub stanowiska.",
    search: "Wyszukaj",
    placeholder: "Imię, nazwisko, e-mail…",
    city: "Miasto",
    allCities: "Wszystkie miasta",
    position: "Stanowisko",
    allPositions: "Wszystkie stanowiska",
    status: "Status",
    allStatuses: "Wszystkie statusy",
    clear: "Wyczyść",
    loading: "Ładowanie…",
    results: "Wyniki",
    candidate: "Kandydat",
    date: "Data aplikacji",
    added: "Dodano",
    missing: "Brak",
    empty: "Brak pasujących kandydatów",
    emptyHelp: "Zmień kryteria wyszukiwania lub wyczyść filtry.",
    error: "Nie udało się pobrać danych. Sprawdź połączenie i spróbuj ponownie.",
    previous: "Poprzednia",
    next: "Następna",
    of: "z",
    language: "Język interfejsu",
  },
  en: {
    recruitment: "Recruitment",
    demo: "Demo version",
    title: "Recruitment overview",
    subtitle: "Manage applications and candidates across branches.",
    refresh: "Refresh data",
    notice: "Demo data — candidates and branches are fictional examples.",
    total: "All applications",
    new: "New applications",
    review: "Under review",
    interview: "Interviews",
    hired: "Hired",
    rejected: "Rejected",
    candidates: "Candidates",
    searchHelp: "Search by name, email address, or position.",
    search: "Search",
    placeholder: "Name, surname, email…",
    city: "City",
    allCities: "All cities",
    position: "Position",
    allPositions: "All positions",
    status: "Status",
    allStatuses: "All statuses",
    clear: "Clear",
    loading: "Loading…",
    results: "Results",
    candidate: "Candidate",
    date: "Application date",
    added: "Uploaded",
    missing: "Missing",
    empty: "No matching candidates",
    emptyHelp: "Change your search criteria or clear the filters.",
    error: "Could not load data. Check your connection and try again.",
    previous: "Previous",
    next: "Next",
    of: "of",
    language: "Interface language",
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

const PAGE_SIZE = 20;

export default function Home() {
  const [language, setLanguage] = useState<Language>("pl");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [page, setPage] = useState<CandidatePage | null>(null);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [overviewError, setOverviewError] = useState(false);

  const t = TEXT[language];
  const statusLabels = language === "pl" ? STATUS_LABELS : EN_STATUSES;

  function positionLabel(value: string) {
    return language === "en" ? EN_POSITIONS[value] ?? value : value;
  }

  useEffect(() => {
    const saved = localStorage.getItem("seka-language");
    if (saved === "en" || saved === "pl") setLanguage(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "pl"
      ? "SEKA — Panel rekrutacji"
      : "SEKA — Recruitment dashboard";
  }, [language]);

  function changeLanguage(value: Language) {
    setLanguage(value);
    localStorage.setItem("seka-language", value);
  }

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiGet<Dashboard>("/dashboard", controller.signal),
      apiGet<Branch[]>("/branches", controller.signal),
      apiGet<string[]>("/positions", controller.signal),
    ])
      .then(([summary, branchList, positionList]) => {
        setDashboard(summary);
        setBranches(branchList);
        setPositions(positionList);
        setOverviewError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setOverviewError(true);
      });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setListError(false);

    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (search.trim()) params.set("search", search.trim());
      if (city) params.set("city", city);
      if (position) params.set("position", position);
      if (status) params.set("status", status);

      apiGet<CandidatePage>(`/candidates?${params}`, controller.signal)
        .then(setPage)
        .catch(() => {
          if (!controller.signal.aborted) setListError(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, city, position, status, offset, refresh]);

  function resetFilters() {
    setSearch("");
    setCity("");
    setPosition("");
    setStatus("");
    setOffset(0);
  }

  const cards = [
    { label: t.total, value: dashboard?.total },
    { label: t.new, value: dashboard?.by_status.new },
    { label: t.review, value: dashboard?.by_status.review },
    { label: t.interview, value: dashboard?.by_status.interview },
    { label: t.hired, value: dashboard?.by_status.hired },
    { label: t.rejected, value: dashboard?.by_status.rejected },
  ];

  return (
    <main className="workspace">
      <header className="topbar">
        <a href="/" className="brand">
          SEKA<span>{t.recruitment}</span>
        </a>
        <div className="header-actions">
          <div className="language-switch" role="group" aria-label={t.language}>
            <button
              className={language === "pl" ? "active" : ""}
              aria-pressed={language === "pl"}
              onClick={() => changeLanguage("pl")}
            >Polski</button>
            <button
              className={language === "en" ? "active" : ""}
              aria-pressed={language === "en"}
              onClick={() => changeLanguage("en")}
            >English</button>
          </div>
          <span className="demo-label">{t.demo}</span>
        </div>
      </header>

      <section className="page-heading">
        <div>
          <p className="eyebrow">{language === "pl" ? "PANEL HR" : "HR DASHBOARD"}</p>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
        </div>
        <button className="secondary-button"
          onClick={() => setRefresh((value) => value + 1)}>
          {t.refresh}
        </button>
      </section>

      <p className="demo-notice">{t.notice}</p>
      <div className="intake-shortcut">
        <a className="secondary-button" href="/intake">
          {language === "pl" ? "+ Dodaj aplikację e-mail" : "+ Add email application"}
        </a>
      </div>
      {overviewError && <p className="error" role="alert">{t.error}</p>}

      <section className="stats-grid" aria-label={t.title}>
        {cards.map((card) => (
          <article className="stat-card" key={card.label}>
            <p>{card.label}</p>
            <strong>{card.value ?? "—"}</strong>
          </article>
        ))}
      </section>

      {dashboard && (
        <section className="branch-summary" aria-label={t.city}>
          {dashboard.by_branch.map((branch) => (
            <button key={branch.branch_id}
              className={city === branch.city ? "branch-chip selected" : "branch-chip"}
              aria-pressed={city === branch.city}
              onClick={() => {
                setCity(city === branch.city ? "" : branch.city);
                setOffset(0);
              }}>
              {branch.city}<strong>{branch.total}</strong>
            </button>
          ))}
        </section>
      )}

      <section className="panel">
        <div className="panel-heading">
          <div><h2>{t.candidates}</h2><p>{t.searchHelp}</p></div>
          <span className="result-count">
            {loading ? t.loading : listError ? "—" : `${t.results}: ${page?.total ?? 0}`}
          </span>
        </div>

        <div className="filters">
          <label className="search-field">
            {t.search}
            <input type="search" placeholder={t.placeholder} value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setOffset(0);
              }} />
          </label>
          <label>
            {t.city}
            <select value={city} onChange={(event) => {
              setCity(event.target.value); setOffset(0);
            }}>
              <option value="">{t.allCities}</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.city}>{branch.city}</option>
              ))}
            </select>
          </label>
          <label>
            {t.position}
            <select value={position} onChange={(event) => {
              setPosition(event.target.value); setOffset(0);
            }}>
              <option value="">{t.allPositions}</option>
              {positions.map((item) => (
                <option key={item} value={item}>{positionLabel(item)}</option>
              ))}
            </select>
          </label>
          <label>
            {t.status}
            <select value={status} onChange={(event) => {
              setStatus(event.target.value); setOffset(0);
            }}>
              <option value="">{t.allStatuses}</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <button className="secondary-button" onClick={resetFilters}>{t.clear}</button>
        </div>

        <div aria-live="polite">
          {listError ? (
            <p className="empty-state error" role="alert">{t.error}</p>
          ) : loading ? (
            <p className="empty-state">{t.loading}</p>
          ) : !page?.items.length ? (
            <div className="empty-state">
              <h3>{t.empty}</h3><p>{t.emptyHelp}</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t.candidate}</th><th>{t.position}</th>
                    <th>{t.city}</th><th>{t.status}</th>
                    <th>{t.date}</th><th>CV</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((candidate) => (
                    <tr key={candidate.id}>
                      <td>
                        <a className="candidate-link" href={`/candidates/${candidate.id}`}><strong>{candidate.first_name} {candidate.last_name}</strong></a>
                        <span className="cell-subtitle">{candidate.email}</span>
                      </td>
                      <td>{positionLabel(candidate.position)}</td>
                      <td>{candidate.branch.city}</td>
                      <td>
                        <span className={`status-badge status-${candidate.status}`}>
                          {statusLabels[candidate.status]}
                        </span>
                      </td>
                      <td>
                        {new Date(candidate.created_at).toLocaleDateString(
                          language === "pl" ? "pl-PL" : "en-GB",
                        )}
                      </td>
                      <td>{candidate.cv_original_filename ? t.added : t.missing}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {page && !loading && !listError && page.total > 0 && (
          <footer className="pagination">
            <span>
              {page.offset + 1}–{Math.min(page.offset + page.items.length, page.total)}
              {" "}{t.of} {page.total}
            </span>
            <div>
              <button className="secondary-button" disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                {t.previous}
              </button>
              <button className="secondary-button"
                disabled={offset + PAGE_SIZE >= page.total}
                onClick={() => setOffset(offset + PAGE_SIZE)}>
                {t.next}
              </button>
            </div>
          </footer>
        )}
      </section>
    </main>
  );
}


