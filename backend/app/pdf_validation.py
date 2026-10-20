"""Structural PDF checks for the demo; not malware scanning or CV content analysis."""
from io import BytesIO
from pypdf import PdfReader


def pdf_problem(content: bytes, filename: str) -> str | None:
    if not filename.lower().endswith(".pdf") or not content.startswith(b"%PDF-"):
        return "Prześlij dokument CV w formacie PDF."
    try:
        reader = PdfReader(BytesIO(content), strict=False)
        if reader.is_encrypted:
            return "Dokument CV jest zaszyfrowany. Prześlij PDF bez hasła."
        if not reader.pages:
            return "Dokument CV nie zawiera stron."
        for page in reader.pages:
            _ = page.mediabox
            contents = page.get_contents()
            if contents is not None:
                contents.get_data()
    except Exception:
        return "Nie można odczytać dokumentu CV. Prześlij poprawny PDF."
    return None
