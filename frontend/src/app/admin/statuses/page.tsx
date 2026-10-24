"use client";

import { FormEvent, useEffect, useState } from "react";
import WorkspaceNavigation from "@/components/WorkspaceNavigation";
import { API_URL, apiGet, DemoContext, RecruitmentStatus } from "@/lib/api";
import { useLanguage } from "@/lib/useLanguage";

type Draft = { code: string; label_pl: string; label_en: string; color: string };
const EMPTY: Draft = { code: "", label_pl: "", label_en: "", color: "#2563eb" };

async function mutate(path: string, method: string, body: unknown) {
  const response = await fetch(`${API_URL}${path}`, { method, credentials: "include", headers: { "Content-Type": "application/json", "Accept": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    const details = result?.errors ? Object.values(result.errors).flat().join(" ") : result?.message;
    throw new Error(details || `HTTP ${response.status}`);
  }
  return response.json();
}

function StatusEditor({ item, pl, busy, save, move, index, last }: {
  item: RecruitmentStatus; pl: boolean; busy: boolean; index: number; last: boolean;
  save: (code: string, data: Partial<RecruitmentStatus>) => void;
  move: (index: number, offset: number) => void;
}) {
  const [labelPl, setLabelPl] = useState(item.label_pl), [labelEn, setLabelEn] = useState(item.label_en), [color, setColor] = useState(item.color);
  useEffect(() => { setLabelPl(item.label_pl); setLabelEn(item.label_en); setColor(item.color); }, [item.label_pl, item.label_en, item.color]);
  const dirty = labelPl !== item.label_pl || labelEn !== item.label_en || color !== item.color;
  function submit(event: FormEvent) { event.preventDefault(); save(item.code, { label_pl: labelPl.trim(), label_en: labelEn.trim(), color }); }
  return <li className="panel status-admin-item"><form onSubmit={submit}>
    <div className="status-admin-heading"><strong>{pl ? item.label_pl : item.label_en}</strong><code>{item.code}</code><span>{item.is_active ? (pl ? "Aktywny" : "Active") : (pl ? "Archiwalny" : "Archived")}</span></div>
    <div className="status-admin-fields">
      <label>Polski<input value={labelPl} onChange={e => setLabelPl(e.target.value)} maxLength={100} required disabled={busy} /></label>
      <label>English<input value={labelEn} onChange={e => setLabelEn(e.target.value)} maxLength={100} required disabled={busy} /></label>
      <label>{pl ? "Kolor" : "Colour"}<input type="color" value={color} onChange={e => setColor(e.target.value)} disabled={busy} /></label>
    </div>
    <div className="status-admin-actions">
      <button type="submit" className="primary-button" disabled={busy || !dirty}>{pl ? "Zapisz etykiety" : "Save labels"}</button>
      <button type="button" className="secondary-button" disabled={busy || dirty || item.code === "new"} onClick={() => save(item.code, { is_active: !item.is_active })}>{item.is_active ? (pl ? "Archiwizuj" : "Archive") : (pl ? "Przywróć" : "Restore")}</button>
      <button type="button" className="secondary-button" disabled={busy || dirty || index === 0} onClick={() => move(index, -1)} aria-label={pl ? "Przesuń w górę" : "Move up"}>↑</button>
      <button type="button" className="secondary-button" disabled={busy || dirty || last} onClick={() => move(index, 1)} aria-label={pl ? "Przesuń w dół" : "Move down"}>↓</button>
    </div>
    {item.code === "new" && <small>{pl ? "Domyślny status nowych aplikacji pozostaje aktywny." : "The default status for new applications stays active."}</small>}
    {dirty && <p className="muted-text">{pl ? "Niezapisane etykiety. Zapisz je przed zmianą kolejności lub archiwizacją." : "Unsaved labels. Save them before reordering or archiving."}</p>}
  </form></li>;
}

export default function StatusAdministration() {
  const [language, changeLanguage] = useLanguage(), pl = language === "pl";
  const [context, setContext] = useState<DemoContext | null>(null);
  const [items, setItems] = useState<RecruitmentStatus[]>([]), [draft, setDraft] = useState<Draft>(EMPTY);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(""), [success, setSuccess] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError("");
    Promise.all([apiGet<DemoContext>("/demo/context", controller.signal), apiGet<RecruitmentStatus[]>("/statuses", controller.signal)])
      .then(([role, list]) => { if (!controller.signal.aborted) { setContext(role); setItems(list); } })
      .catch(() => { if (!controller.signal.aborted) setError(pl ? "Nie udało się pobrać konfiguracji." : "Could not load configuration."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [retry, pl]);
  async function execute(action: () => Promise<unknown>) {
    if (busy) return; setBusy(true); setError(""); setSuccess(false);
    try { await action(); setItems(await apiGet<RecruitmentStatus[]>("/statuses")); setSuccess(true); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Request failed"); }
    finally { setBusy(false); }
  }
  function save(code: string, data: Partial<RecruitmentStatus>) { void execute(() => mutate(`/admin/statuses/${encodeURIComponent(code)}`, "PATCH", data)); }
  function move(index: number, offset: number) {
    const codes = items.map(item => item.code); [codes[index], codes[index + offset]] = [codes[index + offset], codes[index]];
    void execute(() => mutate("/admin/statuses/reorder", "POST", { codes }));
  }
  function create(event: FormEvent) {
    event.preventDefault();
    void execute(async () => { await mutate("/admin/statuses", "POST", { ...draft, label_pl: draft.label_pl.trim(), label_en: draft.label_en.trim() }); setDraft(EMPTY); });
  }
  return <main className="workspace dashboard-workspace">
    <WorkspaceNavigation language={language} changeLanguage={changeLanguage} canEdit={context?.permissions.includes("statuses.manage") ?? false} section="statuses" />
    <section className="page-heading"><div><p className="eyebrow">{pl ? "ADMINISTRACJA" : "ADMINISTRATION"}</p><h1>{pl ? "Statusy rekrutacji" : "Recruitment statuses"}</h1><p>{pl ? "Etykiety, kolory i kolejność dopasowane do procesu SEKA." : "Labels, colours, and ordering for SEKA’s workflow."}</p></div></section>
    <div aria-live="polite">{error && <p className="error" role="alert">{error}</p>}{success && <p className="success-message">{pl ? "Zapisano konfigurację." : "Configuration saved."}</p>}</div>
    {loading ? <p>{pl ? "Ładowanie…" : "Loading…"}</p> : !context ? <button type="button" className="secondary-button" onClick={() => setRetry(v => v + 1)}>{pl ? "Spróbuj ponownie" : "Retry"}</button> : !context.permissions.includes("statuses.manage") ? <p role="alert">{pl ? "Konfigurację może zmieniać tylko administrator." : "Only administrators can change configuration."}</p> : <>
      <p className="correspondence-notice">{pl ? "Archiwizacja zachowuje aplikacje i historię. Status archiwalny pozostaje w filtrach, ale nie można przypisać go do innej aplikacji. Kody są stałe; edytujesz etykiety." : "Archiving preserves applications and history. Archived statuses remain in filters but cannot be assigned to another application. Codes are fixed; labels are editable."}</p>
      <section className="panel profile-card"><h2>{pl ? "Dodaj status" : "Add status"}</h2><form onSubmit={create}>
        <div className="status-admin-fields">
          <label>{pl ? "Stały kod (np. on_hold)" : "Permanent code (e.g. on_hold)"}<input value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} pattern="[a-z][a-z0-9_]*" maxLength={50} required disabled={busy} /></label>
          <label>Polski<input value={draft.label_pl} onChange={e => setDraft({ ...draft, label_pl: e.target.value })} maxLength={100} required disabled={busy} /></label>
          <label>English<input value={draft.label_en} onChange={e => setDraft({ ...draft, label_en: e.target.value })} maxLength={100} required disabled={busy} /></label>
          <label>{pl ? "Kolor" : "Colour"}<input type="color" value={draft.color} onChange={e => setDraft({ ...draft, color: e.target.value })} disabled={busy} /></label>
        </div><button type="submit" className="primary-button" disabled={busy}>{pl ? "Dodaj status" : "Create status"}</button>
      </form></section>
      <ol className="status-admin-list">{items.map((item, index) => <StatusEditor key={item.code} item={item} pl={pl} busy={busy} save={save} move={move} index={index} last={index === items.length - 1} />)}</ol>
    </>}
  </main>;
}
