"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import WorkspaceNavigation from "@/components/WorkspaceNavigation";
import WorkspaceIcon from "@/components/WorkspaceIcon";
import ApplicationConversation from "@/components/ApplicationConversation";
import { apiGet, Branch, DemoContext } from "@/lib/api";
import { InboxItem, MailPage } from "@/lib/mailbox";
import { useLanguage } from "@/lib/useLanguage";
import { useStatuses } from "@/lib/useStatuses";

export default function InboxClient() {
  const [language, changeLanguage] = useLanguage(), pl = language === "pl";
  const params = useSearchParams();
  const [context, setContext] = useState<DemoContext | null>(null), [branches, setBranches] = useState<Branch[]>([]);
  const [selected, setSelected] = useState(params.get("candidate") ?? ""), [filter, setFilter] = useState(params.get("filter") === "drafts" ? "drafts" : params.get("filter") === "incomplete" ? "incomplete" : "all");
  const [search, setSearch] = useState(""), [city, setCity] = useState(""), [page, setPage] = useState(1), [refresh, setRefresh] = useState(0);
  const [list, setList] = useState<MailPage<InboxItem> | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(false), [contextError, setContextError] = useState(false), [dirty, setDirty] = useState(false);
  const { labels, badgeStyle } = useStatuses(language, refresh);
  const saved = useCallback(() => setRefresh(v => v + 1), []);
  useEffect(() => {
    const controller = new AbortController(); setContextError(false);
    apiGet<DemoContext>("/demo/context", controller.signal).then(async value => { if (controller.signal.aborted) return; setContext(value); if (value.permissions.includes("correspondence.view")) { const rows = await apiGet<Branch[]>("/branches", controller.signal); if (!controller.signal.aborted) setBranches(rows); } }).catch(() => { if (!controller.signal.aborted) setContextError(true); });
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    if (!context?.permissions.includes("correspondence.view")) { setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setError(false);
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ filter, page: String(page) }); if (search.trim()) query.set("search", search.trim()); if (city) query.set("city", city);
      apiGet<MailPage<InboxItem>>(`/inbox?${query}`, controller.signal).then(value => { if (!controller.signal.aborted) { setList(value); setSelected(current => current || value.data[0]?.id || ""); } }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [context, search, filter, city, page, refresh]);
  function select(id: string) { if (id === selected || (dirty && !window.confirm(pl ? "Opuścić rozmowę bez zapisania zmian?" : "Leave the conversation without saving changes?"))) return; setDirty(false); setSelected(id); if (window.matchMedia("(max-width: 900px)").matches) setTimeout(() => document.getElementById("active-conversation")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }
  return <main className="workspace dashboard-workspace inbox-workspace">
    <WorkspaceNavigation language={language} changeLanguage={changeLanguage} canEdit={false} section="inbox" />
    <header className="inbox-page-heading"><div><p className="eyebrow">{pl ? "CENTRUM KOMUNIKACJI" : "COMMUNICATION CENTRE"}</p><h1>{pl ? "Skrzynka rekrutacyjna" : "Recruitment inbox"}</h1><p>{pl ? "Wiadomości, aplikacje i szkice odpowiedzi w jednej przestrzeni." : "Messages, applications, and reply drafts in one workspace."}</p></div><div className="mailbox-identity"><WorkspaceIcon name="inbox" /><div><strong>kariera@seka.pl</strong><small><span className="offline-dot" />{pl ? "Tryb symulacji" : "Simulation mode"}</small></div></div></header>
    {contextError ? <div className="empty-state" role="alert"><p>{pl ? "Nie udało się pobrać uprawnień." : "Could not load permissions."}</p><button type="button" className="secondary-button" onClick={saved}>{pl ? "Ponów" : "Retry"}</button></div> : !context ? <p className="empty-state">{pl ? "Ładowanie…" : "Loading…"}</p> : !context.permissions.includes("correspondence.view") ? <p className="empty-state" role="alert">{pl ? "Twoja rola nie ma dostępu do korespondencji." : "Your role cannot view correspondence."}</p> : <>
      <div className="inbox-controls"><div className="inbox-tabs" role="group" aria-label={pl ? "Filtr skrzynki" : "Inbox filter"}>{([['all', pl ? 'Wszystkie rozmowy' : 'All conversations'], ['drafts', pl ? 'Szkice' : 'Drafts'], ['incomplete', pl ? 'Brakujące informacje' : 'Missing information']] as const).map(([key,label]) => <button type="button" key={key} aria-pressed={filter === key} onClick={() => { setFilter(key); setPage(1); }}>{label}</button>)}</div><div className="inbox-controls-right"><label className="sr-only" htmlFor="inbox-city">{pl ? "Oddział" : "Branch"}</label><select id="inbox-city" value={city} onChange={event => { setCity(event.target.value); setPage(1); }}><option value="">{pl ? "Wszystkie dostępne oddziały" : "All accessible branches"}</option>{branches.map(branch => <option key={branch.id} value={branch.city}>{branch.city}</option>)}</select><button type="button" className="secondary-button" onClick={saved}>{pl ? "Odśwież" : "Refresh"}</button></div></div>
      <div className="inbox-grid"><aside className="inbox-thread-panel" aria-label={pl ? "Lista rozmów" : "Conversations"}>
        <label className="inbox-search"><WorkspaceIcon name="search" /><span className="sr-only">{pl ? "Szukaj rozmowy" : "Search conversations"}</span><input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder={pl ? "Nazwisko, e-mail lub temat…" : "Name, email, or subject…"} /></label>
        <div className="inbox-list-heading"><strong>{pl ? "ROZMOWY" : "CONVERSATIONS"}</strong><span>{loading ? "…" : list?.total ?? 0}</span></div>
        {loading ? <p className="thread-state" role="status">{pl ? "Ładowanie rozmów…" : "Loading conversations…"}</p> : error ? <p className="thread-state error" role="alert">{pl ? "Nie udało się pobrać rozmów. Kliknij Odśwież." : "Could not load conversations. Click Refresh."}</p> : !list?.data.length ? <div className="thread-state"><h3>{pl ? "Brak rozmów" : "No conversations"}</h3><p>{pl ? "Zmień filtry lub dodaj przykładową aplikację e-mail." : "Adjust filters or add a sample email application."}</p>{context.permissions.includes("intake.create") && <a href="/intake" className="secondary-button">{pl ? "Dodaj przykładowy e-mail" : "Add sample email"}</a>}</div> : <ul className="inbox-thread-list">{list.data.map(item => <li key={item.id}><button type="button" className={`inbox-thread ${selected === item.id ? "selected" : ""}`} aria-pressed={selected === item.id} onClick={() => select(item.id)}><div className="thread-top"><span className="person-avatar">{item.first_name[0]}{item.last_name[0]}</span><strong>{item.first_name} {item.last_name}</strong><time dateTime={item.last_activity_at}>{new Date(item.last_activity_at).toLocaleDateString(pl ? "pl-PL" : "en-GB", { day: "numeric", month: "short" })}</time></div><p className="thread-subject">{item.latest_subject || (pl ? "Bez tematu" : "No subject")}</p><p className="thread-position">{item.branch?.city ?? (pl ? "Do przypisania" : "Unassigned")} · {item.position || (pl ? "Stanowisko do ustalenia" : "Position to clarify")}</p><div className="thread-bottom"><span className="status-badge" style={badgeStyle(item.status)}>{labels[item.status] ?? item.status}</span><span>{item.draft_count > 0 ? `${pl ? "Szkice" : "Drafts"} ${item.draft_count}` : `${item.message_count} ${pl ? "wiad." : "msgs"}`}</span></div>{!item.is_complete && <small className="thread-incomplete">{pl ? "Brakujące informacje" : "Missing information"}</small>}</button></li>)}</ul>}
        {list && list.last_page > 1 && <div className="inbox-list-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage(v => v - 1)} aria-label={pl ? "Poprzednia strona" : "Previous page"}>←</button><span>{list.current_page} / {list.last_page}</span><button type="button" disabled={page >= list.last_page} onClick={() => setPage(v => v + 1)} aria-label={pl ? "Następna strona" : "Next page"}>→</button></div>}
      </aside><div className="inbox-conversation" id="active-conversation">{selected ? <ApplicationConversation key={selected} candidateId={selected} language={language} context={context} onDirtyChange={setDirty} onSaved={saved} /> : <div className="conversation-empty"><WorkspaceIcon name="inbox" /><h2>{pl ? "Wybierz rozmowę" : "Select a conversation"}</h2><p>{pl ? "Wiadomości i szkice odpowiedzi pojawią się tutaj." : "Messages and reply drafts will appear here."}</p></div>}</div></div>
    </>}
  </main>;
}
