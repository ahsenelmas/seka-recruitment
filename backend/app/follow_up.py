"""Read-only Polish email preview. No queue, SMTP, Graph or delivery side effects."""
ISSUE_REQUESTS = {
    "missing_cv": "dokument CV w formacie PDF",
    "invalid_cv": "poprawny, czytelny dokument CV w formacie PDF bez hasła",
    "missing_city": "miasto / oddział, do którego kierowana jest aplikacja",
    "missing_position": "nazwa stanowiska, na które składana jest aplikacja",
}


def build_follow_up(candidate) -> dict:
    issues = candidate.missing_information
    if not issues:
        return {
            "status": "not_needed", "recipient": candidate.email,
            "subject": None, "body": None, "missing_information": [],
        }
    requests = "\n".join("- " + ISSUE_REQUESTS[code] for code in issues)
    body = (
        "Dzień dobry,\n\n"
        "dziękujemy za przesłanie aplikacji do SEKA. "
        "Aby kontynuować proces rekrutacji, prosimy o uzupełnienie następujących informacji lub dokumentów:\n\n"
        + requests + "\n\n"
        "Prosimy o przesłanie brakujących informacji lub dokumentów w odpowiedzi na tę wiadomość.\n\n"
        "Pozdrawiamy,\nZespół HR SEKA"
    )
    return {
        "status": "draft_only", "recipient": candidate.email,
        "subject": "SEKA — prośba o uzupełnienie aplikacji",
        "body": body, "missing_information": issues,
    }
