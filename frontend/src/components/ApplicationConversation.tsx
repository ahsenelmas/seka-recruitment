"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { apiGet, DemoContext } from "@/lib/api";
import { adminMutation } from "@/lib/adminApi";
import { Conversation, MailMessage } from "@/lib/mailbox";
import WorkspaceIcon from "@/components/WorkspaceIcon";

export default function ApplicationConversation({ candidateId, language, context, onDirtyChange, onSaved }: { candidateId: string; language: "pl" | "en"; context: DemoContext; onDirtyChange?: (value: boolean) => void; onSaved?: () => void }) {
  const pl = language === "pl";
  const [data, setData] = useState<Conversation | null>(null), [loadError, setLoadError] = useState(false);
  const [page, setPage] = useState(1), [reload, setReload] = useState(0), [busy, setBusy] = useState(false), [error, setError] = useState(""), [saved, setSaved] = useState(false);
  const [mode, setMode] = useState<"draft" | "incoming">(context.permissions.includes("correspondence.draft") ? "draft" : "incoming"), [editing, setEditing] = useState<MailMessage | null>(null);
  const [subject, setSubject] = useState(""), [body, setBody] = useState(""), [baseline, setBaseline] = useState({ subject: "", body: "" });
  const clientId = useRef("");
  const dirty = subject !== baseline.subject || body !== baseline.body;
  const canDraft = context.permissions.includes("correspondence.draft");
  const canSimulate = context.permissions.includes("intake.create") && context.scope === "all";
  useEffect(() => {
    const controller = new AbortController(); setLoadError(false);
    apiGet<Conversation>(`/candidates/${candidateId}/messages?page=${page}`, controller.signal)
      .then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [candidateId, page, reload]);
  useEffect(() => { onDirtyChange?.(dirty); return () => onDirtyChange?.(false); }, [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function begin(nextMode: "draft" | "incoming", message?: MailMessage, template = false) {
    if (busy || (dirty && !window.confirm(pl ? "Odrzucić niezapisane zmiany?" : "Discard unsaved changes?"))) return;
    const original = data?.candidate.email_subject || (pl ? "Aplikacja do SEKA" : "Application to SEKA");
    const nextSubject = template ? data?.candidate.follow_up_email.subject ?? original : message?.direction === "outbound" ? message.subject : /^re:/i.test(message?.subject ?? original) ? message?.subject ?? original : `Re: ${message?.subject ?? original}`;
    const nextBody = template ? data?.candidate.follow_up_email.body ?? "" : message?.direction === "outbound" ? message.body : "";
    setMode(nextMode); setEditing(nextMode === "draft" && message?.direction === "outbound" ? message : null);
    setSubject(nextSubject); setBody(nextBody); setBaseline({ subject: nextSubject, body: template ? "" : nextBody }); clientId.current = "";
    setSaved(false); setError("");
    setTimeout(() => document.getElementById(`reply-body-${candidateId}`)?.focus(), 0);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy || !data || (mode === "draft" && !canDraft) || (mode === "incoming" && !canSimulate)) return;
    setBusy(true); setError(""); setSaved(false);
    if (!clientId.current) clientId.current = crypto.randomUUID();
    try {
      const result = await adminMutation<MailMessage>(editing && mode === "draft" ? `/candidates/${candidateId}/messages/${editing.id}` : `/candidates/${candidateId}/messages${mode === "incoming" ? "/sample-incoming" : ""}`, editing && mode === "draft" ? "PATCH" : "POST", { subject: subject.trim(), body: body.trim(), ...(editing && mode === "draft" ? { version: editing.version } : { client_id: clientId.current }) });
      if (mode === "draft") { setEditing(result); setSubject(result.subject); setBody(result.body); setBaseline({ subject: result.subject, body: result.body }); }
      else { setSubject(""); setBody(""); setBaseline({ subject: "", body: "" }); clientId.current = ""; }
      setPage(1); setReload(value => value + 1); setSaved(true); onSaved?.();
    } catch (failure) { setError(failure instanceof Error ? failure.message : (pl ? "Nie udało się zapisać." : "Could not save.")); }
    finally { setBusy(false); }
  }
  if (loadError && !data) return <section className="conversation-error" role="alert"><h2>{pl ? "Nie udało się pobrać rozmowy" : "Could not load conversation"}</h2><button type="button" className="secondary-button" onClick={() => setReload(v => v + 1)}>{pl ? "Spróbuj ponownie" : "Retry"}</button></section>;
  if (!data) return <p className="empty-state" role="status">{pl ? "Ładowanie korespondencji…" : "Loading conversation…"}</p>;
  return <section className="conversation-panel">
    {loadError && <p className="error conversation-inline-error" role="alert">{pl ? "Nie udało się odświeżyć rozmowy. Twoje niezapisane zmiany pozostają w edytorze." : "Could not refresh the conversation. Your unsaved changes remain in the editor."}</p>}
    <header className="conversation-header"><div className="person-avatar">{data.candidate.first_name[0]}{data.candidate.last_name[0]}</div><div><h2>{data.candidate.first_name} {data.candidate.last_name}</h2><p>{data.candidate.email} <span>· {data.candidate.branch?.city ?? (pl ? "Oddział do przypisania" : "Unassigned branch")}</span></p></div><a href={`/candidates/${candidateId}`} className="secondary-button conversation-profile-link">{pl ? "Profil" : "Profile"}<WorkspaceIcon name="arrow" /></a></header>
    <div className="conversation-context"><span>{data.candidate.position || (pl ? "Stanowisko do ustalenia" : "Position to clarify")}</span><span>{pl ? "Aplikacja" : "Application"} · {new Date(data.candidate.created_at).toLocaleDateString(pl ? "pl-PL" : "en-GB")}</span></div>
    <div className="mailbox-offline"><span className="offline-dot" />{pl ? "Skrzynka niepołączona. Odpowiedzi są zapisywane wyłącznie jako szkice." : "Mailbox not connected. Replies are saved as drafts only."}</div>
    <div className="conversation-toolbar"><strong>{pl ? "Korespondencja" : "Conversation"} <span className="count-pill">{data.messages.total}</span></strong><div><button type="button" className="text-action" disabled={busy} onClick={() => setReload(v => v + 1)}>{pl ? "Odśwież rozmowę" : "Refresh conversation"}</button>{canDraft && <button type="button" className="secondary-button" disabled={busy} onClick={() => begin("draft")}>{pl ? "Nowy szkic" : "New draft"}</button>}{canSimulate && <button type="button" className="text-action" disabled={busy} onClick={() => begin("incoming")}>{pl ? "Dodaj fikcyjną odpowiedź kandydata" : "Add fictional candidate reply"}</button>}</div></div>
    {!data.messages.data.length ? <div className="conversation-empty"><WorkspaceIcon name="inbox" /><h3>{pl ? "Ta aplikacja nie ma jeszcze rozmowy" : "No conversation for this application yet"}</h3><p>{pl ? "Przyjęte wiadomości i zapisane szkice pojawią się tutaj." : "Incoming messages and saved drafts will appear here."}</p></div> : <ol className="conversation-messages">{data.messages.data.slice().reverse().map(message => <li key={message.id} className={`message-card ${message.direction === "outbound" ? "message-draft" : "message-incoming"}`}>
      <div className="message-heading"><div><span className={`message-label ${message.direction}`}>{message.direction === "outbound" ? (pl ? "SZKIC · NIE WYSŁANO" : "DRAFT · NOT SENT") : (pl ? "WIADOMOŚĆ PRZYCHODZĄCA" : "INCOMING MESSAGE")}</span><h3>{message.subject || (pl ? "Bez tematu" : "No subject")}</h3></div><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(pl ? "pl-PL" : "en-GB", { dateStyle: "short", timeStyle: "short" })}</time></div>
      <p className="message-addresses">{pl ? "Od" : "From"}: {message.sender} <span>→</span> {message.recipient}</p>
      <p className="message-body">{message.body}</p>
      <footer><small>{message.source === "existing_source_email" ? (pl ? "Zaimportowano z zapisanej wiadomości źródłowej" : "Imported from the stored original email") : message.source === "reply_draft" ? (pl ? "Szkic zapisany w systemie" : "Draft saved in the system") : (pl ? "Wiadomość fikcyjna · symulacja" : "Fictional message · simulation")}</small>{canDraft && <button type="button" className="text-action" disabled={busy} onClick={() => begin("draft", message)}>{message.direction === "outbound" ? (pl ? "Edytuj szkic" : "Edit draft") : (pl ? "Przygotuj odpowiedź" : "Draft reply")}</button>}</footer>
    </li>)}</ol>}
    {data.messages.last_page > 1 && <div className="history-pagination conversation-pagination"><button type="button" className="secondary-button" disabled={page >= data.messages.last_page} onClick={() => setPage(v => v + 1)}>{pl ? "Starsze wiadomości" : "Older messages"}</button><span>{data.messages.current_page} / {data.messages.last_page}</span><button type="button" className="secondary-button" disabled={page <= 1} onClick={() => setPage(v => v - 1)}>{pl ? "Nowsze" : "Newer"}</button></div>}
    {(canDraft || canSimulate) && <form className="reply-composer" onSubmit={save}>
      <div className="composer-heading"><h3>{mode === "incoming" ? (pl ? "Fikcyjna wiadomość przychodząca" : "Fictional incoming message") : editing ? (pl ? "Edytuj zapisany szkic" : "Edit saved draft") : (pl ? "Przygotuj odpowiedź" : "Prepare a reply")}</h3>{canDraft && data.candidate.follow_up_email.status === "draft_only" && <button type="button" className="text-action" disabled={busy} onClick={() => begin("draft", undefined, true)}>{pl ? "Użyj szablonu uzupełnienia" : "Use Polish missing-info template"}</button>}</div>
      <p className="composer-addresses">{pl ? "Od" : "From"}: <strong>{mode === "incoming" ? data.candidate.email : data.mailbox}</strong> <span>→</span> {mode === "incoming" ? data.mailbox : data.candidate.email}</p>
      <label>{pl ? "Temat" : "Subject"}<input value={subject} maxLength={255} required disabled={busy} onChange={event => { setSubject(event.target.value); setSaved(false); }} placeholder={pl ? "Temat wiadomości" : "Message subject"} /></label>
      <label className="reply-body-label">{pl ? "Treść" : "Message"}<textarea id={`reply-body-${candidateId}`} value={body} maxLength={20000} required disabled={busy} onChange={event => { setBody(event.target.value); setSaved(false); }} placeholder={pl ? "Napisz wiadomość…" : "Write a message…"} /></label>
      <div className="composer-footer"><p>{mode === "incoming" ? (pl ? "Tylko symulacja. Bez pobierania poczty lub załączników." : "Simulation only. Does not retrieve email or attachments.") : (pl ? "Wiadomość nie zostanie wysłana." : "This message will not be sent.")}</p><button type="submit" className="primary-button" disabled={busy || !subject.trim() || !body.trim() || (mode === "draft" && (!canDraft || (!!editing && !dirty))) || (mode === "incoming" && !canSimulate)}>{busy ? (pl ? "Zapisywanie…" : "Saving…") : mode === "incoming" ? (pl ? "Dodaj fikcyjną wiadomość" : "Add fictional message") : (pl ? "Zapisz szkic" : "Save draft")}</button></div>
      <div aria-live="polite">{error && <p className="error" role="alert">{error}</p>}{saved && <p className="success-message">{mode === "incoming" ? (pl ? "Zapisano fikcyjną wiadomość." : "Fictional message saved.") : (pl ? "Zapisano szkic. Nie wysłano wiadomości." : "Draft saved. No email was sent.")}</p>}{dirty && <p className="muted-text">{pl ? "Niezapisane zmiany" : "Unsaved changes"}</p>}</div>
    </form>}
  </section>;
}
