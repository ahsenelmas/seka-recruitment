"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, type DemoContext } from "@/lib/api";
import type { Language } from "@/lib/useLanguage";
export default function WorkspaceNavigation({language, changeLanguage, canEdit, section}: {
  language: Language; changeLanguage: (value: Language) => void; canEdit: boolean;
  section: "overview" | "profile" | "intake";
}) {
  const pl = language === "pl";
  const [context,setContext]=useState<DemoContext|null>(null);
  useEffect(()=>{const controller=new AbortController();apiGet<DemoContext>("/demo/context",controller.signal).then(setContext).catch(()=>{});return()=>controller.abort();},[]);
  const roleLabel=context?.role==="admin"?(pl?"Administrator":"Administrator"):context?.role==="branch_manager"?(pl?"Kierownik oddziału":"Branch manager"):(pl?"Menedżer HR":"HR manager");
  const branchLabel=context?.branches.find(b=>b.id===context.branch_id)?.city;

  return <>
    <aside className="dashboard-sidebar">
      <Link href="/" className="sidebar-brand">SEKA<span className="brand-mark" /></Link>
      <p className="sidebar-caption">{pl ? "CENTRUM REKRUTACJI" : "RECRUITMENT CENTRE"}</p>
      <p className="nav-caption">{pl ? "PRZESTRZEŃ ROBOCZA" : "WORKSPACE"}</p>
      <nav aria-label={pl ? "Nawigacja główna" : "Main navigation"}>
        <Link href="/" className={section === "overview" ? "nav-active" : ""} aria-current={section === "overview" ? "page" : undefined}><span aria-hidden="true">▦</span>{pl ? "Przegląd rekrutacji" : "Recruitment overview"}</Link>
        <Link href="/#candidate-list" className={section === "profile" ? "nav-active" : ""}><span aria-hidden="true">◎</span>{pl ? "Kandydaci" : "Candidates"}</Link>
        {canEdit && <Link href="/intake" className={section === "intake" ? "nav-active" : ""} aria-current={section === "intake" ? "page" : undefined}><span aria-hidden="true">＋</span>{pl ? "Nowa aplikacja" : "New application"}</Link>}
      </nav>
      <div className="sidebar-note"><span className="sidebar-note-line" /><strong>{pl ? "Ludzie. Możliwości. Rozwój." : "People. Opportunity. Growth."}</strong><p>{pl ? "Wszystkie aplikacje w jednym miejscu." : "Every application in one place."}</p></div>
      <div className="sidebar-footer"><span className="sidebar-avatar">HR</span><div><strong>{pl ? "Centrum HR" : "HR centre"}</strong><p>SEKA · {pl ? "Rekrutacja" : "Recruitment"}</p></div></div>
    </aside>
    <header className="topbar">
      <div className="topbar-breadcrumb"><span>SEKA</span><span aria-hidden="true">/</span><strong>{section === "profile" ? (pl ? "Profil kandydata" : "Candidate profile") : section === "intake" ? (pl ? "Nowa aplikacja" : "New application") : (pl ? "Przegląd rekrutacji" : "Recruitment overview")}</strong></div>
      <div className="header-actions"><div className="language-switch" role="group" aria-label={pl ? "Język interfejsu" : "Interface language"}>
        <button type="button" className={pl ? "active" : ""} aria-pressed={pl} onClick={() => changeLanguage("pl")}>Polski</button>
        <button type="button" className={!pl ? "active" : ""} aria-pressed={!pl} onClick={() => changeLanguage("en")}>English</button>
      </div><span className="workspace-role">{context ? roleLabel : (pl?"Ładowanie roli…":"Loading role…")}{branchLabel && <small>{branchLabel}</small>}</span><button type="button" className="secondary-button change-role" onClick={()=>{sessionStorage.removeItem("seka-demo-entered");window.location.assign("/login");}}>{pl?"Zmień rolę":"Change role"}</button></div>
    </header>
  </>;
}
