"use client";

import Link from "next/link";
import WorkspaceIcon from "@/components/WorkspaceIcon";
import { useEffect, useState } from "react";
import { apiGet, DemoContext } from "@/lib/api";
import type { Language } from "@/lib/useLanguage";

type Section = "tasks" | "inbox" | "overview" | "applications" | "profile" | "intake" | "statuses" | "roles" | "system";
export default function WorkspaceNavigation({ language, changeLanguage, section }: {
  language: Language; changeLanguage: (value: Language) => void; canEdit: boolean; section: Section;
}) {
  const pl = language === "pl";
  const [context, setContext] = useState<DemoContext | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    apiGet<DemoContext>("/demo/context", controller.signal).then(data => { if (!controller.signal.aborted) setContext(data); }).catch(() => {});
    return () => controller.abort();
  }, []);
  const allows = (permission: string) => context?.permissions.includes(permission) ?? false;
  const roleLabel = context ? (pl ? context.role_definition.label_pl : context.role_definition.label_en) : (pl ? "Ładowanie roli…" : "Loading role…");
  const branchLabel = context?.branches.find(branch => branch.id === context.branch_id)?.city;
  const title = {
    applications: pl ? "Aplikacje" : "Applications",
    tasks: pl ? "Zadania i terminy" : "Tasks & deadlines",
    inbox: pl ? "Skrzynka rekrutacyjna" : "Recruitment inbox",
    overview: pl ? "Przegląd rekrutacji" : "Recruitment overview",
    profile: pl ? "Profil kandydata" : "Candidate profile",
    intake: pl ? "Przyjęcie e-mail" : "Email intake",
    statuses: pl ? "Statusy rekrutacji" : "Recruitment statuses",
    roles: pl ? "Role i uprawnienia" : "Roles & permissions",
    system: pl ? "Ustawienia systemu" : "System settings",
  };
  const links = [
    { href: "/inbox", key: "inbox", label: pl ? "Skrzynka" : "Inbox", permission: "correspondence.view", icon: "inbox" },
    { href: "/", key: "overview", label: title.overview, permission: "applications.view", icon: "▦" },
    { href: "/applications", key: "applications", label: pl ? "Aplikacje" : "Applications", permission: "applications.view", icon: "profile" },
    { href: "/tasks", key: "tasks", label: pl ? "Zadania" : "Tasks", permission: "tasks.view", icon: "tasks" },
    { href: "/intake", key: "intake", label: title.intake, permission: "intake.create", icon: "＋" },
    { href: "/admin/statuses", key: "statuses", label: title.statuses, permission: "statuses.manage", icon: "⚙" },
    { href: "/admin/roles", key: "roles", label: title.roles, permission: "roles.manage", icon: "◇" },
    { href: "/system/settings", key: "system", label: title.system, permission: "system.configure", icon: "⚙" },
  ];
  return <>
    <aside className="dashboard-sidebar">
      <Link href={allows("system.configure") ? "/system/settings" : "/"} className="sidebar-brand">SEKA<span>RECRUITMENT</span></Link>
      <p className="sidebar-caption">{pl ? "PRZESTRZEŃ ZESPOŁU" : "TEAM WORKSPACE"}</p>
      <p className="nav-caption">{pl ? "PRZESTRZEŃ ROBOCZA" : "WORKSPACE"}</p>
      <nav aria-label={pl ? "Nawigacja główna" : "Main navigation"}>
        {links.filter(link => allows(link.permission)).map(link => <Link key={link.key} href={link.href} className={(section === link.key || (section === "profile" && link.key === "applications")) ? "nav-active" : ""} aria-current={section === link.key ? "page" : undefined}><WorkspaceIcon name={link.icon === "profile" ? "profile" : link.key} />{link.label}</Link>)}
      </nav>
      <div className="sidebar-note mailbox-sidebar-note"><WorkspaceIcon name="inbox" /><strong>kariera@seka.pl</strong><p>{pl ? "Tryb symulacji · poczta niepołączona" : "Simulation · mailbox not connected"}</p></div>
      <div className="sidebar-footer"><span className="sidebar-avatar">S</span><div><strong>{context?.employee?.name ?? roleLabel}</strong><p>SEKA · {branchLabel ?? (pl ? "Cała firma" : "Company-wide")}</p></div></div>
    </aside>
    <header className="topbar">
      <div className="topbar-breadcrumb"><span className="environment-tag">DEMO</span><span aria-hidden="true">/</span><strong>{title[section]}</strong></div>
      <div className="header-actions"><div className="language-switch" role="group" aria-label={pl ? "Język interfejsu" : "Interface language"}>
        <button type="button" className={pl ? "active" : ""} aria-pressed={pl} onClick={() => changeLanguage("pl")}>Polski</button>
        <button type="button" className={!pl ? "active" : ""} aria-pressed={!pl} onClick={() => changeLanguage("en")}>English</button>
      </div><span className="workspace-role">{context?.employee?.name ?? roleLabel}{branchLabel && <small>{branchLabel}</small>}</span><button type="button" className="secondary-button change-role" onClick={() => { sessionStorage.removeItem("seka-demo-entered"); window.location.assign("/login"); }}>{pl ? "Zmień rolę" : "Change role"}</button></div>
    </header>
  </>;
}
