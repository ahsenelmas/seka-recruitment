"use client";
import { useEffect, useState } from "react";
import { API_URL, apiGet, DemoContext } from "@/lib/api";

export default function DemoRoleSelector({ language, onContext }: {
  language: "pl" | "en"; onContext?: (context: DemoContext) => void;
}) {
  const [context, setContext] = useState<DemoContext | null>(null);
  const [role, setRole] = useState<DemoContext["role"]>("hr_manager");
  const [branch, setBranch] = useState("");
  const [adminOverview, setAdminOverview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pl = language === "pl";
  useEffect(() => {
    const controller = new AbortController();
    apiGet<DemoContext>("/demo/context", controller.signal).then(data => {
      setContext(data); setRole(data.role); setBranch(String(data.branch_id ?? ""));
      onContext?.(data);
      if (data.role === "admin") {
        apiGet("/demo/admin-overview", controller.signal).then(() => setAdminOverview(true))
          .catch(() => { if (!controller.signal.aborted) setError(true); });
      }
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [onContext]);
  async function apply() {
    if (busy) return;
    setBusy(true); setError(false);
    try {
      const response = await fetch(`${API_URL}/demo/context`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, branch_id: role === "branch_manager" ? Number(branch) : null }),
      });
      if (!response.ok) throw new Error();
      window.location.assign("/");
    } catch { setError(true); setBusy(false); }
  }
  return <section className="demo-role-panel">
    <div><strong>{pl ? "Symulacja ról" : "Role simulation"}</strong>
      <p className="muted-text">{pl ? "Tryb demonstracyjny bez logowania. Wybór roli nie jest uwierzytelnianiem." : "Demo without login. Choosing a role is not authentication."}</p></div>
    <div className="demo-role-controls">
      <label>{pl ? "Rola" : "Role"}<select value={role} disabled={busy} onChange={e => setRole(e.target.value as DemoContext["role"])}>
        <option value="admin">{pl ? "Administrator" : "Administrator"}</option>
        <option value="hr_manager">{pl ? "Menedżer HR — cała firma" : "HR manager — whole company"}</option>
        <option value="branch_manager">{pl ? "Kierownik oddziału — tylko odczyt" : "Branch manager — read only"}</option>
      </select></label>
      {role === "branch_manager" && <label>{pl ? "Oddział" : "Branch"}<select value={branch} disabled={busy} onChange={e => setBranch(e.target.value)}>
        <option value="">{pl ? "Wybierz oddział" : "Choose branch"}</option>
        {context?.branches.map(b => <option key={b.id} value={b.id}>{b.city}</option>)}
      </select></label>}
      <button type="button" className="secondary-button" onClick={apply}
        disabled={busy || !context || (role === "branch_manager" && !branch)}>{busy ? "…" : pl ? "Zastosuj" : "Apply"}</button>
    </div>
    {adminOverview && <details>
      <summary style={{ cursor: "pointer", marginTop: 16 }}>{pl ? "Administrator — stan integracji" : "Administrator — integration status"}</summary>
      <p className="muted-text">{pl ? "Logowanie Entra ID: niepołączone. Wysyłka e-mail: nieskonfigurowana. Zarządzanie użytkownikami i edycja konfiguracji będą dostępne po migracji do Laravel." : "Entra ID: not connected. Email delivery: not configured. User management and configuration editing will follow the Laravel migration."}</p>
    </details>}
    {error && <p className="error" role="alert">{pl ? "Nie udało się ustawić roli. Sprawdź połączenie z API." : "Could not set role. Check the API connection."}</p>}
  </section>;
}
