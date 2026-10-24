"use client";

import { FormEvent, useEffect, useState } from "react";
import WorkspaceNavigation from "@/components/WorkspaceNavigation";
import { apiGet, DemoContext, RecruitmentRole, PermissionDefinition } from "@/lib/api";
import { adminMutation } from "@/lib/adminApi";
import { useLanguage } from "@/lib/useLanguage";

type RoleData = { roles: RecruitmentRole[]; permissions: PermissionDefinition[] };
type Draft = { code: string; label_pl: string; label_en: string; scope: "all" | "branch"; permissions: string[]; is_active: boolean };
const EMPTY: Draft = { code: "", label_pl: "", label_en: "", scope: "branch", permissions: ["applications.view"], is_active: true };
function RoleForm({ initial, definitions, pl, busy, submit, creating = false }: { initial: Draft; definitions: PermissionDefinition[]; pl: boolean; busy: boolean; submit: (draft: Draft) => void; creating?: boolean }) {
  const [draft, setDraft] = useState(initial);
  function toggle(code: string, checked: boolean) {
    let permissions = checked ? [...draft.permissions, code] : draft.permissions.filter(item => item !== code);
    if (checked && ["tasks.manage", "tasks.complete", "work.assign"].includes(code)) permissions.push("tasks.view");
    if (!checked && code === "tasks.view") permissions = permissions.filter(item => !["tasks.manage", "tasks.complete", "work.assign"].includes(item));
    if (checked && code === "correspondence.draft") permissions.push("correspondence.view");
    if (!checked && code === "correspondence.view") permissions = permissions.filter(item => item !== "correspondence.draft");
    if (checked && code === "cv.upload") permissions.push("cv.view");
    if (!checked && code === "cv.view") permissions = permissions.filter(item => item !== "cv.upload");
    setDraft({ ...draft, permissions: [...new Set(permissions)] });
  }
  function save(event: FormEvent) { event.preventDefault(); submit(draft); }
  return <form onSubmit={save}><fieldset disabled={busy} className="role-fieldset">
    <div className="status-admin-fields">
      {creating && <label>{pl ? "Stały kod" : "Permanent code"}<input required pattern="[a-z][a-z0-9_]*" maxLength={50} value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })} placeholder="assistant" /></label>}
      <label>Polski<input required maxLength={100} value={draft.label_pl} onChange={e => setDraft({ ...draft, label_pl: e.target.value })} /></label>
      <label>English<input required maxLength={100} value={draft.label_en} onChange={e => setDraft({ ...draft, label_en: e.target.value })} /></label>
      <label>{pl ? "Zakres" : "Scope"}<select value={draft.scope} onChange={e => setDraft({ ...draft, scope: e.target.value as Draft["scope"], permissions: e.target.value === "branch" ? draft.permissions.filter(code => !["intake.create", "applications.assign_branch"].includes(code)) : draft.permissions })}><option value="branch">{pl ? "Wybrany oddział" : "Selected branch"}</option><option value="all">{pl ? "Cała firma" : "Company-wide"}</option></select></label>
    </div>
    <div className="role-permission-grid">{definitions.map(permission => <label key={permission.code}><input type="checkbox" checked={draft.permissions.includes(permission.code)} disabled={permission.code === "applications.view" || (draft.scope === "branch" && ["intake.create", "applications.assign_branch"].includes(permission.code))} onChange={e => toggle(permission.code, e.target.checked)} /><span>{pl ? permission.label_pl : permission.label_en}</span></label>)}</div>
    <p className="muted-text">{pl ? "Zakres oddziałowy nie pozwala na przyjęcie aplikacji ani przenoszenie między oddziałami. Przesyłanie CV wymaga prawa otwierania CV. Szkice wymagają przeglądu korespondencji." : "Branch scope excludes intake and branch reassignment. Uploading CVs requires permission to open CVs. Drafts require permission to view correspondence."}</p>
    <button type="submit" className="primary-button">{creating ? (pl ? "Utwórz rolę" : "Create role") : (pl ? "Zapisz uprawnienia" : "Save permissions")}</button>
  </fieldset></form>;
}

export default function RolesPage() {
  const [language, changeLanguage] = useLanguage(), pl = language === "pl";
  const [context, setContext] = useState<DemoContext | null>(null), [data, setData] = useState<RoleData | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false), [retry, setRetry] = useState(0), [newVersion, setNewVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError("");
    apiGet<DemoContext>("/demo/context", controller.signal).then(async value => {
      if (controller.signal.aborted) return; setContext(value);
      if (value.permissions.includes("roles.manage")) { const roles = await apiGet<RoleData>("/admin/roles", controller.signal); if (!controller.signal.aborted) setData(roles); }
    }).catch(() => { if (!controller.signal.aborted) setError(pl ? "Nie udało się pobrać ról." : "Could not load roles."); });
    return () => controller.abort();
  }, [retry, pl]);
  async function save(draft: Draft, creating: boolean) {
    if (busy) return; setBusy(true); setError(""); setSaved(false);
    try {
      const { code, label_pl, label_en, scope, permissions, is_active } = draft;
      const fields = { label_pl, label_en, scope, permissions, is_active };
      await adminMutation(creating ? "/admin/roles" : `/admin/roles/${encodeURIComponent(code)}`, creating ? "POST" : "PATCH", creating ? { code, ...fields } : fields);
      setData(await apiGet<RoleData>("/admin/roles")); if (creating) setNewVersion(v => v + 1); setSaved(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Request failed"); }
    finally { setBusy(false); }
  }
  return <main className="workspace dashboard-workspace">
    <WorkspaceNavigation language={language} changeLanguage={changeLanguage} canEdit={false} section="roles" />
    <section className="page-heading"><div><p className="eyebrow">{pl ? "ADMINISTRACJA" : "ADMINISTRATION"}</p><h1>{pl ? "Role i uprawnienia" : "Roles & permissions"}</h1><p>{pl ? "Dopasuj zakres i działania do zespołu." : "Configure scope and actions for your team."}</p></div></section>
    <div aria-live="polite">{error && <p className="error" role="alert">{error}</p>}{saved && <p className="success-message">{pl ? "Zapisano rolę. Uprawnienia obowiązują przy kolejnym żądaniu API." : "Role saved. Permissions apply on the next API request."}</p>}</div>
    {!context ? <button type="button" className="secondary-button" onClick={() => setRetry(v => v + 1)}>{pl ? "Załaduj ponownie" : "Reload"}</button> : !context.permissions.includes("roles.manage") ? <p role="alert">{pl ? "Brak prawa zarządzania rolami." : "You cannot manage roles."}</p> : !data ? <p>{pl ? "Ładowanie…" : "Loading…"}</p> : <>
      <p className="correspondence-notice">{pl ? "Role są wybierane w symulacji. Nie są jeszcze przypisane do kont Microsoft. Zakres oddziału wybierasz przy wejściu; przypisania użytkowników i wiele oddziałów pozostają do wdrożenia." : "Roles are selected in simulation and are not linked to Microsoft accounts. A branch is selected on entry; user assignments and multiple-branch access remain to be implemented."}</p>
      <details className="panel profile-card admin-create"><summary>{pl ? "+ Dodaj rolę" : "+ Add role"}</summary><RoleForm key={newVersion} initial={EMPTY} definitions={data.permissions} pl={pl} busy={busy} creating submit={draft => void save(draft, true)} /></details>
      <div className="status-admin-list">{data.roles.map(role => <details className="panel status-admin-item role-admin-row" key={role.code}>
        <summary className="status-admin-heading"><h2>{pl ? role.label_pl : role.label_en}</h2><code>{role.code}</code><span>{role.is_active ? (pl ? "Aktywna" : "Active") : (pl ? "Archiwalna" : "Archived")}</span><small>{role.scope === "branch" ? (pl ? "Oddział" : "Branch") : (pl ? "Cała firma" : "Company-wide")}</small></summary>
        {["admin", "system_admin"].includes(role.code) ? <p>{role.code === "admin" ? (pl ? "Chroniona rola: rekrutacja, role i statusy. Bez ustawień technicznych." : "Protected role: recruitment, roles, and statuses. No technical settings.") : (pl ? "Chroniona rola: wyłącznie ustawienia techniczne. Bez danych kandydatów." : "Protected role: technical settings only. No candidate data.")}</p> : <>
          <RoleForm key={`${role.code}-${role.updated_at}-${role.permissions.join(",")}-${role.scope}-${role.is_active}-${role.label_pl}-${role.label_en}`} initial={role} definitions={data.permissions} pl={pl} busy={busy} submit={draft => void save(draft, false)} />
          {!role.is_builtin && <button type="button" className="secondary-button" disabled={busy} onClick={() => void save({ ...role, is_active: !role.is_active }, false)}>{role.is_active ? (pl ? "Archiwizuj rolę" : "Archive role") : (pl ? "Przywróć rolę" : "Restore role")}</button>}
        </>}
      </details>)}</div>
    </>}
  </main>;
}
