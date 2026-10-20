import { Candidate } from "@/lib/api";

const LABELS: Record<string, { pl: string; en: string }> = {
  missing_cv: { pl: "Brak CV", en: "Missing CV" },
  invalid_cv: { pl: "Nieprawidłowy plik CV", en: "Unreadable CV" },
  missing_city: { pl: "Brak miasta", en: "Missing city" },
  missing_position: { pl: "Brak stanowiska", en: "Missing position" },
};
export default function ApplicationCompleteness({ candidate, language }: {
  candidate: Candidate; language: "pl" | "en";
}) {
  return <div className="completeness" aria-label={language === "pl" ? "Kompletność aplikacji" : "Application completeness"}>
    <span className={`status-badge ${candidate.is_complete ? "status-hired" : "status-review"}`}>
      {candidate.is_complete ? (language === "pl" ? "Kompletna" : "Complete") :
        (language === "pl" ? "Wymaga uzupełnienia" : "Needs information")}
    </span>
    {!candidate.is_complete && <ul>{candidate.missing_information.map(code =>
      <li key={code}>{LABELS[code]?.[language] ?? code}</li>)}</ul>}
  </div>;
}
