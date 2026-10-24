"use client";

import { FormEvent, useEffect, useState } from "react";
import WorkspaceNavigation from "@/components/WorkspaceNavigation";
import { apiGet, DemoContext } from "@/lib/api";
import { adminMutation } from "@/lib/adminApi";
import { useLanguage } from "@/lib/useLanguage";

type Settings = { azure_tenant_id: string; azure_client_id: string; azure_redirect_uri: string; ai_provider: string; ai_model: string; azure_client_secret_configured: boolean; ai_api_key_configured: boolean; integration_connected: boolean };
const FIELDS = ["azure_tenant_id", "azure_client_id", "azure_redirect_uri", "ai_provider", "ai_model"] as const;
const LABELS = { azure_tenant_id: ["Identyfikator dzierżawy Microsoft", "Microsoft tenant ID"], azure_client_id: ["Identyfikator aplikacji Microsoft", "Microsoft client ID"], azure_redirect_uri: ["Adres przekierowania", "Redirect URL"], ai_provider: ["Dostawca AI", "AI provider"], ai_model: ["Model AI", "AI model"] };
export default function SystemSettingsPage() {
  const [language, changeLanguage] = useLanguage(), pl = language === "pl";
  const [context, setContext] = useState<DemoContext | null>(null), [settings, setSettings] = useState<Settings | null>(null);
  const [secret, setSecret] = useState({ azure_client_secret: "", ai_api_key: "" });
  const [clear, setClear] = useState({ azure_client_secret: false, ai_api_key: false });
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError("");
    apiGet<DemoContext>("/demo/context", controller.signal).then(async value => {
      if (controller.signal.aborted) return; setContext(value);
      if (value.permissions.includes("system.configure")) { const config = await apiGet<Settings>("/system/settings", controller.signal); if (!controller.signal.aborted) setSettings(config); }
    }).catch(() => { if (!controller.signal.aborted) setError(pl ? "Nie udało się pobrać ustawień." : "Could not load settings."); });
    return () => controller.abort();
  }, [retry, pl]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!settings || busy) return; setBusy(true); setError(""); setSaved(false);
    try {
      const body: Record<string, unknown> = Object.fromEntries(FIELDS.map(key => [key, settings[key] || null]));
      for (const key of ["azure_client_secret", "ai_api_key"] as const) { if (secret[key]) body[key] = secret[key]; if (clear[key]) body[`clear_${key}`] = true; }
      setSettings(await adminMutation<Settings>("/system/settings", "PATCH", body));
      setSecret({ azure_client_secret: "", ai_api_key: "" }); setClear({ azure_client_secret: false, ai_api_key: false }); setSaved(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Request failed"); }
    finally { setBusy(false); }
  }
  return <main className="workspace dashboard-workspace">
    <WorkspaceNavigation language={language} changeLanguage={changeLanguage} canEdit={false} section="system" />
    <section className="page-heading"><div><p className="eyebrow">SYSTEM ADMIN</p><h1>{pl ? "Ustawienia systemu" : "System settings"}</h1><p>{pl ? "Konfiguracja integracji Microsoft i AI." : "Microsoft and AI integration configuration."}</p></div></section>
    {error && <p className="error" role="alert">{error}</p>}{saved && <p className="success-message" role="status">{pl ? "Zapisano ustawienia." : "Settings saved."}</p>}
    {!context ? <button type="button" className="secondary-button" onClick={() => setRetry(v => v + 1)}>{pl ? "Załaduj ponownie" : "Reload"}</button> : !context.permissions.includes("system.configure") ? <p role="alert">{pl ? "Dostęp tylko dla administratora systemu." : "System Admin access required."}</p> : !settings ? <p>{pl ? "Ładowanie…" : "Loading…"}</p> : <>
      <p className="correspondence-notice">{pl ? "Integracje nie są połączone. Ten ekran zapisuje konfigurację, ale nie uruchamia logowania, AI ani wysyłki poczty. W symulacji wpisuj wyłącznie fikcyjne sekrety." : "Integrations are not connected. This screen saves configuration without enabling login, AI, or email delivery. Use fictional secrets in simulation."}</p>
      <section className="panel profile-card"><form onSubmit={submit}><fieldset disabled={busy} className="role-fieldset">
        <div className="status-admin-fields">{FIELDS.map(key => <label key={key}>{LABELS[key][pl ? 0 : 1]}<input type={key === "azure_redirect_uri" ? "url" : "text"} maxLength={key === "azure_redirect_uri" ? 500 : 100} value={settings[key]} onChange={e => setSettings({ ...settings, [key]: e.target.value })} /></label>)}</div>
        <div className="status-admin-fields">{(["azure_client_secret", "ai_api_key"] as const).map(key => <div key={key}><label>{key === "ai_api_key" ? (pl ? "Klucz API AI" : "AI API key") : "Microsoft client secret"}<input type="password" autoComplete="new-password" maxLength={4096} value={secret[key]} disabled={clear[key]} onChange={e => setSecret({ ...secret, [key]: e.target.value })} /></label><p>{settings[`${key}_configured`] ? (pl ? "Skonfigurowany — wartość ukryta" : "Configured — value hidden") : (pl ? "Nieskonfigurowany" : "Not configured")}</p><label className="role-clear"><input type="checkbox" checked={clear[key]} onChange={e => { setClear({ ...clear, [key]: e.target.checked }); if (e.target.checked) setSecret({ ...secret, [key]: "" }); }} />{pl ? "Usuń zapisany sekret" : "Remove stored secret"}</label></div>)}</div>
        <p className="muted-text">{pl ? "Puste pole zachowuje zapisany sekret. Sekrety są szyfrowane i nie są zwracane przez API." : "A blank field keeps the stored secret. Secrets are encrypted and never returned by the API."}</p>
        <button type="submit" className="primary-button">{busy ? (pl ? "Zapisywanie…" : "Saving…") : (pl ? "Zapisz konfigurację" : "Save configuration")}</button>
      </fieldset></form></section>
    </>}
  </main>;
}
