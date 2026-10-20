"use client";

import { useState } from "react";
import { FollowUpEmail } from "@/lib/api";

const TEXT = {
  pl: {
    title: "Prośba o uzupełnienie aplikacji",
    draft: "Wersja robocza — nie wysłano",
    notice: "Podgląd przygotowany na podstawie zapisanych danych. Wysyłka e-mail nie jest jeszcze skonfigurowana. Wiadomość do kandydata jest w języku polskim.",
    complete: "Aplikacja jest kompletna. Prośba o uzupełnienie nie jest potrzebna.",
    recipient: "Odbiorca", subject: "Temat", body: "Treść wiadomości",
    copy: "Kopiuj treść", copied: "Skopiowano treść wiadomości.",
    failed: "Nie udało się skopiować. Zaznacz i skopiuj treść ręcznie.",
    unsaved: "Masz niezapisane zmiany. Zapisz je, aby zaktualizować podgląd.",
  },
  en: {
    title: "Request missing information",
    draft: "Draft — not sent",
    notice: "Preview based on saved information. Email delivery is not configured yet. The candidate email is written in Polish.",
    complete: "The application is complete. No follow-up request is needed.",
    recipient: "Recipient", subject: "Subject", body: "Email body",
    copy: "Copy body", copied: "Email body copied.",
    failed: "Could not copy. Select and copy the text manually.",
    unsaved: "You have unsaved changes. Save them to update this preview.",
  },
};

export default function FollowUpEmailPreview({ email, language, dirty }: {
  email: FollowUpEmail; language: "pl" | "en"; dirty: boolean;
}) {
  const t = TEXT[language];
  const [message, setMessage] = useState<"copied" | "failed" | null>(null);
  async function copyBody() {
    if (!email.body) return;
    try {
      await navigator.clipboard.writeText(email.body);
      setMessage("copied");
    } catch {
      setMessage("failed");
    }
  }
  return <section className="panel profile-card email-original">
    <h2>{t.title}</h2>
    {dirty && <p className="muted-text" role="status">{t.unsaved}</p>}
    {email.status === "not_needed" ? <p className="success-message">{t.complete}</p> : <>
      <p><span className="status-badge status-review">{t.draft}</span></p>
      <p className="muted-text">{t.notice}</p>
      <dl className="detail-list">
        <div><dt>{t.recipient}</dt><dd>{email.recipient}</dd></div>
        <div><dt>{t.subject}</dt><dd>{email.subject}</dd></div>
      </dl>
      <details>
        <summary style={{ cursor: "pointer", margin: "16px 0" }}>{t.body}</summary>
        <p className="email-body">{email.body}</p>
        <button type="button" className="secondary-button" onClick={copyBody}>{t.copy}</button>
        <p aria-live="polite" className="muted-text">{message ? t[message] : ""}</p>
      </details>
    </>}
  </section>;
}
