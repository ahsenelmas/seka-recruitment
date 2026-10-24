"use client";
import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/api";

type Field = "first_name" | "last_name" | "position" | "branch_id";
type Suggestion = { value: string; label?: string; source: "email" | "cv"; evidence: string };
type Preview = { suggestions: Record<Field, Suggestion | null>; issues: string[]; cv_status: string };
export default function IntakeReview({ email, subject, body, file, values, apply, language }: {
  email: string; subject: string; body: string; file: File | null;
  values: Record<Field, string>; apply: (field: Field, value: string) => void; language: "pl" | "en";
}) {
  const pl = language === "pl";
  const [preview, setPreview] = useState<Preview | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => { request.current?.abort(); setPreview(null); setBusy(false); setError(false); return () => request.current?.abort(); }, [email, subject, body, file]);
  const labels: Record<Field, string> = { first_name: pl ? "Imię" : "First name", last_name: pl ? "Nazwisko" : "Last name", position: pl ? "Stanowisko" : "Position", branch_id: pl ? "Oddział" : "Branch" };
  function issue(code: string) {
    if (code.startsWith("ambiguous_")) return (pl ? "Sprzeczne lub różne wartości: " : "Conflicting or multiple values: ") + (labels[code.slice(10) as Field] ?? code);
    if (code.startsWith("missing_") && code !== "missing_cv") return (pl ? "Do uzupełnienia: " : "Needs manual entry: ") + (labels[code.slice(8) as Field] ?? code);
    return ({ missing_cv: pl ? "Brak CV." : "No CV attached.", unreadable_cv: pl ? "Nie można odczytać PDF. Sprawdź dokument." : "PDF could not be read. Check the document.", cv_no_text: pl ? "PDF nie zawiera odczytywalnego tekstu. Wymaga ręcznego przeglądu; OCR nie jest dostępny." : "PDF has no extractable text. Manual review needed; OCR is not available.", cv_preview_limited: pl ? "Przejrzano maksymalnie 5 stron i 20 000 znaków CV." : "Preview covers up to 5 pages and 20,000 CV characters." } as Record<string, string>)[code] ?? code;
  }
  async function analyze() {
    if (busy) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(false); setPreview(null);
    const data = new FormData(); data.append("email", email.trim()); data.append("email_subject", subject.trim()); data.append("email_body", body.trim()); if (file) data.append("file", file);
    try {
      const response = await fetch(`${API_URL}/intake/preview`, { method: "POST", credentials: "include", body: data, signal: controller.signal });
      if (!response.ok) throw new Error();
      const result: Preview = await response.json(); if (!controller.signal.aborted) setPreview(result);
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="intake-review" aria-labelledby="intake-review-title">
    <div className="intake-review-heading"><div><h2 id="intake-review-title">{pl ? "Przegląd wiadomości i CV" : "Email & CV review"}</h2><p className="muted-text">{pl ? "Lokalne reguły, bez AI. Sugestie wymagają weryfikacji. Podgląd niczego nie zapisuje." : "Local rules, no AI. Verify every suggestion. Preview does not save anything."}</p></div><button type="button" className="secondary-button" disabled={busy || !email.trim() || !subject.trim() || !body.trim() || (!!file && file.size > 5 * 1024 * 1024)} onClick={analyze}>{busy ? (pl ? "Analizowanie…" : "Reviewing…") : (pl ? "Odczytaj sugestie" : "Find suggestions")}</button></div>
    {error && <p className="error" role="alert">{pl ? "Nie udało się przygotować podglądu. Sprawdź adres example.com, załącznik (maks. 5 MB) i połączenie API. Po wielu próbach odczekaj minutę." : "Preview failed. Check the example.com sender, attachment (max. 5 MB), and API connection. After repeated attempts, wait one minute."}</p>}
    {preview && <div aria-live="polite"><div className="table-scroll"><table><thead><tr><th>{pl ? "Pole" : "Field"}</th><th>{pl ? "Sugestia i źródło" : "Suggestion & evidence"}</th><th>{pl ? "Przegląd" : "Review"}</th></tr></thead><tbody>{(Object.keys(labels) as Field[]).map(field => { const item = preview.suggestions[field]; return <tr key={field}><td>{labels[field]}</td><td>{item ? <><strong>{item.label ?? item.value}</strong><small className="intake-evidence">{item.source === "email" ? (pl ? "E-mail" : "Email") : "CV"}: {item.evidence}</small></> : <span className="muted-text">{pl ? "Brak jednoznacznej sugestii" : "No unambiguous suggestion"}</span>}</td><td>{item && <button type="button" className="secondary-button" disabled={values[field] === item.value} onClick={() => { if (values[field] && values[field] !== item.value && !window.confirm(pl ? "Zastąpić ręcznie wpisaną wartość?" : "Replace the value already entered?")) return; apply(field, item.value); }}>{values[field] === item.value ? (pl ? "Zastosowano" : "Applied") : (pl ? "Zastosuj" : "Apply")}</button>}</td></tr>; })}</tbody></table></div>{preview.issues.length > 0 && <ul className="intake-issues">{preview.issues.map(code => <li key={code}>{issue(code)}</li>)}</ul>}<p className="muted-text">{pl ? "Nazwy pól Imię:, Nazwisko:, Stanowisko: (lub First name:, Last name:, Position:) ułatwiają odczyt. Dopasowanie miasta obejmuje nazwy oddziałów, bez oceny zamiaru kandydata. Sprawdź oryginalną wiadomość." : "Labels First name:, Last name:, Position: (or Polish equivalents) support extraction. City matching uses branch names and does not infer the applicant’s intent. Check the original message."}</p></div>}
  </section>;
}
