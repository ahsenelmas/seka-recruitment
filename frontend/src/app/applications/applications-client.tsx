"use client";
import { useEffect, useState } from "react";
import { apiGet, Branch, CandidatePage, DemoContext } from "@/lib/api";
import { useLanguage } from "@/lib/useLanguage";
import { useStatuses } from "@/lib/useStatuses";
import WorkspaceNavigation from "@/components/WorkspaceNavigation";
import WorkspaceIcon from "@/components/WorkspaceIcon";
import CandidateProfile from "@/app/candidates/[id]/profile-client";

export default function ApplicationsClient() {
  const [language, changeLanguage] = useLanguage(), pl = language === "pl";
  const [context, setContext] = useState<DemoContext | null>(null), [branches, setBranches] = useState<Branch[]>([]);
  const [data, setData] = useState<CandidatePage | null>(null), [search, setSearch] = useState(""), [city, setCity] = useState(""), [status, setStatus] = useState(""), [offset, setOffset] = useState(0), [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState(""), [dirty, setDirty] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const { statuses, labels, badgeStyle } = useStatuses(language, retry);
  useEffect(() => { document.title = pl ? "SEKA — Aplikacje" : "SEKA — Applications"; }, [pl]);
  useEffect(() => {
    const controller = new AbortController();
    apiGet<DemoContext>("/demo/context", controller.signal).then(async value => { if (controller.signal.aborted) return; setContext(value); if (value.permissions.includes("applications.view")) { const list = await apiGet<Branch[]>("/branches", controller.signal); if (!controller.signal.aborted) setBranches(list); } }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    if (!context?.permissions.includes("applications.view")) return;
    const controller = new AbortController(); setLoading(true); setError(false);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ limit: "20", offset: String(offset) }); if (search.trim()) params.set("search", search.trim()); if (city) params.set("city", city); if (status) params.set("status", status);
      apiGet<CandidatePage>(`/candidates?${params}`, controller.signal).then(value => { if (!controller.signal.aborted) { setData(value); setSelected(current => current || value.items[0]?.id || ""); } }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [context, search, city, status, offset, retry]);
  function select(id: string) {
    if (id === selected || (dirty && !window.confirm(pl ? "Opuścić aplikację bez zapisania zmian?" : "Leave this application without saving changes?"))) return;
    setDirty(false); setSelected(id);
    if (window.matchMedia("(max-width: 900px)").matches) setTimeout(() => document.getElementById("application-inspector")?.scrollIntoView({ behavior: "smooth" }), 0);
  }
  return <main className="workspace dashboard-workspace applications-workspace">
    <WorkspaceNavigation language={language} changeLanguage={changeLanguage} canEdit={false} section="applications" />
    <section className="page-heading compact-page-heading"><div><p className="eyebrow">{pl ? "BAZA APLIKACJI" : "APPLICATION REGISTER"}</p><h1>{pl ? "Aplikacje spontaniczne" : "Spontaneous applications"}</h1><p>{pl ? "Wybierz zgłoszenie, aby przejrzeć dokumenty i kolejne działania." : "Select a submission to review documents and next actions."}</p></div><button type="button" className="secondary-button" onClick={() => setRetry(v => v + 1)}>{pl ? "Odśwież listę" : "Refresh list"}</button></section>
    {context && !context.permissions.includes("applications.view") ? <p className="empty-state" role="alert">{pl ? "Brak dostępu do aplikacji." : "You cannot view applications."}</p> : <>
    <div className="application-browser-filters"><label className="browser-search"><WorkspaceIcon name="search" /><span className="sr-only">{pl ? "Szukaj" : "Search"}</span><input type="search" value={search} onChange={e => { setSearch(e.target.value); setOffset(0); }} placeholder={pl ? "Imię, nazwisko, e-mail, stanowisko" : "Name, email, position"} /></label><label><span className="sr-only">{pl ? "Oddział" : "Branch"}</span><select value={city} onChange={e => { setCity(e.target.value); setOffset(0); }}><option value="">{pl ? "Wszystkie oddziały" : "All branches"}</option>{branches.map(branch => <option key={branch.id} value={branch.city}>{branch.city}</option>)}</select></label><label><span className="sr-only">{pl ? "Status" : "Status"}</span><select value={status} onChange={e => { setStatus(e.target.value); setOffset(0); }}><option value="">{pl ? "Wszystkie statusy" : "All statuses"}</option>{statuses.map(item => <option key={item.code} value={item.code}>{labels[item.code]}</option>)}</select></label><span className="result-count">{loading ? "…" : data?.total ?? "—"} {pl ? "zgłoszeń" : "submissions"}</span></div>
    <div className="application-browser"><aside className="application-register"><div className="register-column-heading"><span>{pl ? "KANDYDAT / STANOWISKO" : "APPLICANT / POSITION"}</span><span>{pl ? "STATUS" : "STATUS"}</span></div>
      {error ? <div className="empty-state" role="alert"><p>{pl ? "Nie udało się pobrać aplikacji." : "Could not load applications."}</p><button type="button" className="secondary-button" onClick={() => setRetry(v => v + 1)}>{pl ? "Ponów" : "Retry"}</button></div> : loading ? <p className="empty-state" role="status">{pl ? "Ładowanie…" : "Loading…"}</p> : !data?.items.length ? <p className="empty-state">{pl ? "Brak aplikacji dla wybranych filtrów." : "No applications match these filters."}</p> : <ol className="register-rows">{data.items.map(item => <li key={item.id}><button type="button" className={selected === item.id ? "register-row selected" : "register-row"} aria-pressed={selected === item.id} onClick={() => select(item.id)}><div className="register-main"><strong>{item.first_name} {item.last_name}</strong><span className="status-badge" style={badgeStyle(item.status)}>{labels[item.status] ?? item.status}</span></div><p>{item.position || (pl ? "Stanowisko do ustalenia" : "Position to clarify")}</p><div className="register-meta"><span>{item.branch?.city || (pl ? "Do przypisania" : "Unassigned")}</span><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString(pl ? "pl-PL" : "en-GB")}</time></div></button></li>)}</ol>}
      {data && <div className="inbox-list-pagination"><button type="button" aria-label={pl ? "Poprzednia strona" : "Previous page"} disabled={offset === 0} onClick={() => setOffset(v => Math.max(0, v - 20))}>←</button><span>{Math.floor(offset / 20) + 1} / {Math.max(1, Math.ceil(data.total / 20))}</span><button type="button" aria-label={pl ? "Następna strona" : "Next page"} disabled={offset + 20 >= data.total} onClick={() => setOffset(v => v + 20)}>→</button></div>}
    </aside><div className="application-inspector" id="application-inspector">{selected ? <CandidateProfile key={selected} candidateId={selected} embedded onDirtyChange={setDirty} onSaved={updated => setData(current => current ? { ...current, items: current.items.map(item => item.id === updated.id ? updated : item) } : current)} /> : <div className="conversation-empty"><WorkspaceIcon name="profile" /><h2>{pl ? "Wybierz aplikację" : "Select an application"}</h2><p>{pl ? "Dokumenty, korespondencja i zadania pojawią się w tym panelu." : "Documents, correspondence, and tasks will appear in this panel."}</p></div>}</div></div>
    </>}
  </main>;
}
