"use client";

import { useRef, useState } from "react";
import { API_URL, Candidate } from "@/lib/api";

const TEXT = {
  pl: {
    title: "Dokument CV",
    choose: "Wybierz PDF",
    hint: "PDF, maksymalnie 5 MB. Nowy plik zastąpi poprzedni dokument.",
    upload: "Prześlij CV",
    uploading: "Przesyłanie…",
    open: "Otwórz PDF",
    preview: "Podgląd CV",
    missing: "Nie dodano jeszcze dokumentu CV.",
    success: "Dokument CV został zapisany.",
    error: "Nie udało się przesłać dokumentu. Spróbuj ponownie.",
    invalid: "Wybierz plik PDF o rozmiarze do 5 MB.",
  },
  en: {
    title: "CV document",
    choose: "Choose PDF",
    hint: "PDF, maximum 5 MB. A new file will replace the previous document.",
    upload: "Upload CV",
    uploading: "Uploading…",
    open: "Open PDF",
    preview: "CV preview",
    missing: "No CV document has been uploaded yet.",
    success: "CV document saved successfully.",
    error: "Could not upload the document. Please try again.",
    invalid: "Choose a PDF file no larger than 5 MB.",
  },
};

type Props = {
  candidateId: string;
  filename: string | null;
  language: "pl" | "en";
  onUploaded: (candidate: Candidate) => void;
};

export default function CandidateCV({
  candidateId,
  filename,
  language,
  onUploaded,
}: Props) {
  const t = TEXT[language];
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<"success" | "error" | "invalid" | null>(null);
  const [version, setVersion] = useState(0);
  const [showPreview, setShowPreview] = useState(false);

  const cvUrl = `${API_URL}/candidates/${candidateId}/cv?v=${version}`;

  async function upload() {
    if (!file || uploading) return;

    if (!file.name.toLowerCase().endsWith(".pdf") ||
        file.size === 0 || file.size > 5 * 1024 * 1024) {
      setMessage("invalid");
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch(
        `${API_URL}/candidates/${candidateId}/cv`,
        { method: "POST", body },
      );

      if (!response.ok) throw new Error("Upload failed");

      const updated: Candidate = await response.json();
      onUploaded(updated);
      setVersion(Date.now());
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setMessage("success");
    } catch {
      setMessage("error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="cv-summary">
      <h2>{t.title}</h2>
      <p className="cv-filename">{filename || t.missing}</p>

      {filename && (
        <div className="cv-actions">
          <a className="secondary-button" href={cvUrl}
            target="_blank" rel="noopener noreferrer">
            {t.open}
          </a>
          <button type="button" className="secondary-button"
            aria-expanded={showPreview}
            onClick={() => setShowPreview((value) => !value)}>
            {t.preview}
          </button>
        </div>
      )}

      <div className="cv-upload">
        <label>
          {t.choose}
          <input ref={inputRef} type="file"
            accept=".pdf,application/pdf" disabled={uploading}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setMessage(null);
            }} />
        </label>
        <p className="muted-text">{t.hint}</p>
        <button type="button" className="primary-button"
          disabled={!file || uploading} onClick={upload}>
          {uploading ? t.uploading : t.upload}
        </button>
      </div>

      <div aria-live="polite">
        {message === "success" && (
          <p className="success-message">{t.success}</p>
        )}
        {(message === "error" || message === "invalid") && (
          <p className="error" role="alert">{t[message]}</p>
        )}
      </div>

      {filename && showPreview && (
        <iframe key={cvUrl} className="cv-preview"
          src={cvUrl} title={t.preview} />
      )}
    </div>
  );
}
