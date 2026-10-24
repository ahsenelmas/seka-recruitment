"use client";
import { useEffect, useState } from "react";
import { API_URL, apiGet, type Branch, type DemoContext, type RecruitmentRole, type DemoCatalog, type DemoEmployee } from "@/lib/api";
import { useLanguage } from "@/lib/useLanguage";
export default function LoginPage() {
 const [language, changeLanguage] = useLanguage(); const pl = language === "pl";
 const [accountMode,setAccountMode] = useState(true); const [employees,setEmployees] = useState<DemoEmployee[]>([]); const [employeeId,setEmployeeId] = useState("");
 const [roleDefinitions,setRoleDefinitions] = useState<RecruitmentRole[]>([]);
 const [role,setRole] = useState<DemoContext["role"]>("hr_manager");
 const [branches,setBranches] = useState<Branch[]>([]); const [branch,setBranch] = useState("");
 const [ready,setReady] = useState(false); const [busy,setBusy] = useState(false); const [error,setError] = useState(false); const [retry,setRetry] = useState(0);
 useEffect(()=>{document.documentElement.lang=language;document.title=pl?"SEKA — Dostęp do systemu":"SEKA — Workspace access";},[language,pl]);
 useEffect(()=>{const controller=new AbortController();setReady(false);setError(false);
 apiGet<DemoCatalog>("/demo/catalog",controller.signal).then(data=>{setBranches(data.branches);setRoleDefinitions(data.roles);setEmployees(data.employees);setEmployeeId(data.employees.find(item=>item.role_code==="hr_manager")?.id ?? data.employees[0]?.id ?? "");setReady(true);}).catch(()=>{if(!controller.signal.aborted)setError(true);});return()=>controller.abort();},[retry]);
 async function enter(event: React.FormEvent<HTMLFormElement>) {event.preventDefault();if(busy||!ready||(accountMode&&!selectedEmployee)||(!accountMode&&requiresBranch&&!branch))return;setBusy(true);setError(false);
 try {const response=await fetch(`${API_URL}/demo/${accountMode?"employee":"context"}`,{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(accountMode?{employee_id:employeeId}:{role,branch_id:requiresBranch?Number(branch):null})});if(!response.ok)throw Error();
 sessionStorage.setItem("seka-demo-entered","yes");window.location.assign(selectedRole?.permissions.includes("system.configure")?"/system/settings":selectedRole?.permissions.includes("roles.manage")?"/admin/roles":"/");
 }catch{setError(true);setBusy(false);}}
 const selectedEmployee=employees.find(item=>item.id===employeeId);
 const selectedRole=roleDefinitions.find(item=>item.code===(accountMode?selectedEmployee?.role_code:role));
 const requiresBranch=selectedRole?.scope==="branch";
 return <main className="access-page">
  <header className="access-topbar"><a href="/login" className="access-wordmark">SEKA<span>{pl?"REKRUTACJA":"RECRUITMENT"}</span></a><div className="language-switch" role="group" aria-label={pl?"Język":"Language"}><button type="button" aria-pressed={pl} className={pl?"active":""} onClick={()=>changeLanguage("pl")}>PL</button><button type="button" aria-pressed={!pl} className={!pl?"active":""} onClick={()=>changeLanguage("en")}>EN</button></div></header>
  <section className="access-panel">
    <div className="access-heading"><p className="eyebrow">{pl?"SYSTEM REKRUTACJI":"RECRUITMENT SYSTEM"}</p><h1>{pl?"Dostęp do przestrzeni roboczej":"Workspace access"}</h1><p>{pl?"Wybierz fikcyjne konto, aby sprawdzić przypisany widok i zadania.":"Choose a fictional account to review its workspace and assigned tasks."}</p></div>
    <div className="demo-login-modes" role="group" aria-label={pl?"Tryb dostępu":"Access mode"}><button type="button" disabled={busy} aria-pressed={accountMode} onClick={()=>setAccountMode(true)}>{pl?"Konto demonstracyjne":"Demo account"}</button><button type="button" disabled={busy} aria-pressed={!accountMode} onClick={()=>setAccountMode(false)}>{pl?"Podgląd roli":"Role preview"}</button></div>
    <form onSubmit={enter}><fieldset disabled={busy}><legend className="sr-only">{pl?"Wybór dostępu":"Access selection"}</legend>
      {accountMode?<label>{pl?"Fikcyjny pracownik":"Fictional employee"}<select required value={employeeId} disabled={!ready} onChange={event=>setEmployeeId(event.target.value)}>{employees.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>:<label>{pl?"Rola":"Role"}<select required value={role} disabled={!ready} onChange={event=>setRole(event.target.value)}>{roleDefinitions.map(item=><option key={item.code} value={item.code}>{pl?item.label_pl:item.label_en}</option>)}</select></label>}
      {!accountMode&&requiresBranch&&<label>{pl?"Oddział":"Branch"}<select required value={branch} onChange={event=>setBranch(event.target.value)}><option value="">{pl?"Wybierz oddział":"Choose branch"}</option>{branches.map(item=><option key={item.id} value={item.id}>{item.city}</option>)}</select></label>}
      {selectedRole&&<dl className="access-account-details">{accountMode&&selectedEmployee&&<div><dt>{pl?"Konto":"Account"}</dt><dd>{selectedEmployee.email}</dd></div>}<div><dt>{pl?"Rola":"Role"}</dt><dd>{pl?selectedRole.label_pl:selectedRole.label_en}</dd></div><div><dt>{pl?"Zakres":"Scope"}</dt><dd>{selectedRole.scope==="all"?(pl?"Cała firma":"Company-wide"):branches.find(item=>item.id===(accountMode?selectedEmployee?.branch_id:Number(branch)))?.city??(pl?"Wybierz oddział":"Choose branch")}</dd></div></dl>}
      <button type="submit" className="primary-button access-submit" disabled={!ready||busy||!selectedRole||(!accountMode&&requiresBranch&&!branch)}>{busy?(pl?"Otwieranie…":"Opening…"):!ready?(pl?"Łączenie z API…":"Connecting to API…"):(pl?"Otwórz przestrzeń roboczą":"Open workspace")}<span aria-hidden="true">↗</span></button>
    </fieldset>{error&&<div role="alert" className="access-error"><p className="error">{pl?"Nie udało się otworzyć widoku. Sprawdź odpowiedź API Laravel na porcie 8001.":"Could not open the workspace. Check the Laravel API response on port 8001."}</p><button type="button" className="secondary-button" onClick={()=>setRetry(value=>value+1)}>{pl?"Spróbuj ponownie":"Retry"}</button></div>}</form>
    <footer className="access-disclosure"><span className="environment-tag">DEMO</span><p>{pl?"Konta są fikcyjne i nie wymagają hasła. To nie jest uwierzytelnianie. Microsoft Entra ID pozostaje niepołączone.":"Accounts are fictional and need no password. This is not authentication. Microsoft Entra ID is not connected."}</p></footer>
  </section>
  <footer className="access-footer"><span>SEKA · {pl?"System rekrutacji":"Recruitment system"}</span><span>{pl?"Środowisko demonstracyjne":"Demonstration environment"}</span></footer>
 </main>;
}
