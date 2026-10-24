"use client";
import { useStatuses } from "@/lib/useStatuses";
import WorkspaceNavigation from "@/components/WorkspaceNavigation";
import { useLanguage } from "@/lib/useLanguage";

import DemoRoleSelector from "@/components/DemoRoleSelector";
import ApplicationCompleteness from "@/components/ApplicationCompleteness";
import { useCallback, useEffect, useState } from "react";
import {
  apiGet,
  Branch,
  CandidatePage,
  CandidateStatus,
  Dashboard,
  DemoContext,
} from "@/lib/api";



const TEXT = {
  pl: {
    recruitment: "Rekrutacja",
    title: "Dobre decyzje zaczynają się od ludzi.",
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
    title: "Great decisions start with people.",
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



const EN_POSITIONS: Record<string, string> = {
  "Specjalista ds. BHP": "Occupational health and safety specialist",
  "Koordynator szkoleń": "Training coordinator",
  "Specjalista ds. administracji": "Administration specialist",
};

const PAGE_SIZE = 20;

export default function Home() {
  const [canEdit, setCanEdit] = useState(false);
  const onDemoContext = useCallback((context: DemoContext) => setCanEdit(context.permissions.includes("intake.create")), []);
  const [language, changeLanguage] = useLanguage();
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
  const { statuses, labels: statusLabels, badgeStyle, error: statusesError } = useStatuses(language, refresh);

  function positionLabel(value: string | null) {
    if (!value) return language === "pl" ? "Brak stanowiska" : "Missing position";
    return language === "en" ? EN_POSITIONS[value] ?? value : value;
  }


  useEffect(() => {
    document.documentElement.lang = language;
    document.title = language === "pl"
      ? "SEKA — Panel rekrutacji"
      : "SEKA — Recruitment dashboard";
  }, [language]);


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
    { code: "", label: t.total, value: dashboard?.total },
    ...statuses.map(item => ({ code: item.code, label: statusLabels[item.code], value: dashboard?.by_status[item.code] ?? 0 })),
  ];

  return (
    <main className="workspace dashboard-workspace">
      <WorkspaceNavigation language={language} changeLanguage={changeLanguage} canEdit={canEdit} section="overview" />
      <DemoRoleSelector language={language} onContext={onDemoContext} />

      <section className="page-heading overview-hero" id="overview">
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


      {canEdit && <div className="intake-shortcut">
        <a className="secondary-button" href="/intake">
          {language === "pl" ? "+ Dodaj aplikację e-mail" : "+ Add email application"}
        </a>
      </div>}
      {statusesError && <p className="error" role="alert">{language === "pl" ? "Nie udało się pobrać statusów. Odśwież dane." : "Could not load statuses. Refresh the data."}</p>}
      {overviewError && <p className="error" role="alert">{t.error}</p>}

      <section className="stats-grid" aria-label={language === "pl" ? "Statystyki rekrutacji" : "Recruitment statistics"}>
        {cards.map((card, index) => (
          <button className="stat-card stat-filter" key={card.code}
            aria-pressed={status === card.code}
            onClick={() => {
              setStatus(card.code);
              setOffset(0);
              document.getElementById("candidate-list")?.scrollIntoView();
            }}>
            <div className="stat-topline"><p>{card.label}</p><span aria-hidden="true">{index === 0 ? "◎" : "●"}</span></div>
            <strong>{card.value ?? "—"}</strong>
          </button>
        ))}
      </section>

      {dashboard && <section className="pipeline-panel" aria-label={language === "pl" ? "Struktura aplikacji" : "Application distribution"}>
        <div className="pipeline-title"><strong>{language === "pl" ? "Struktura aplikacji" : "Application distribution"}</strong><span>{language === "pl" ? "Aktualny stan rekrutacji" : "Current recruitment snapshot"}</span></div>
        <div className="pipeline-track">{statuses.map(item => item.code).map(key => dashboard.by_status[key] > 0 && <div key={key} className={`pipeline-segment pipeline-${key}`} style={{flex: dashboard.by_status[key], backgroundColor: statuses.find(item => item.code === key)?.color}} title={`${statusLabels[key]}: ${dashboard.by_status[key]}`} />)}</div>
        <div className="pipeline-legend">{statuses.map(item => item.code).map(key => <span key={key}><i style={{backgroundColor: statuses.find(item => item.code === key)?.color}} />{statusLabels[key]} <strong>{dashboard.by_status[key]}</strong></span>)}</div>
      </section>}
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
          {dashboard.unassigned > 0 && <span className="branch-chip">
            {language === "pl" ? "Bez przypisanego miasta" : "No assigned city"}
            <strong>{dashboard.unassigned}</strong>
          </span>}
        </section>
      )}

      <section className="panel" id="candidate-list">
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
                    <th>{t.date}</th><th>CV</th><th>{language === "pl" ? "Profil" : "Profile"}</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((candidate) => (
                    <tr key={candidate.id}>
                      <td>
                        <div className="candidate-identity">
                          <span className="candidate-avatar" aria-hidden="true">
                            {candidate.first_name.slice(0, 1)}{candidate.last_name.slice(0, 1)}
                          </span>
                          <div>
                            <a className="candidate-link" href={`/candidates/${candidate.id}`}>
                              <strong>{candidate.first_name} {candidate.last_name}</strong>
                            </a>
                            <span className="cell-subtitle">{candidate.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>{positionLabel(candidate.position)}<ApplicationCompleteness candidate={candidate} language={language} /></td>
                      <td>{candidate.branch?.city ?? (language === "pl" ? "Brak miasta" : "Missing city")}</td>
                      <td>
                        <span className={`status-badge status-${candidate.status}`} style={badgeStyle(candidate.status)}>
                          {statusLabels[candidate.status] ?? candidate.status}
                        </span>
                      </td>
                      <td>
                        {new Date(candidate.created_at).toLocaleDateString(
                          language === "pl" ? "pl-PL" : "en-GB",
                        )}
                      </td>
                      <td>
                        <span className={candidate.cv_original_filename ? "cv-present" : "muted-text"}>
                          {candidate.cv_original_filename ? t.added : t.missing}
                        </span>
                      </td>
                      <td>
                        <a className="profile-action" href={`/candidates/${candidate.id}`}
                          aria-label={`${language === "pl" ? "Otwórz profil" : "Open profile"}: ${candidate.first_name} ${candidate.last_name}`}>
                          {language === "pl" ? "Otwórz" : "Open"} →
                        </a>
                      </td>
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



